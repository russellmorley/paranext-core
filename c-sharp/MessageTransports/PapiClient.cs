using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Paranext.DataProvider.JsonUtils;
using Paranext.DataProvider.MessageHandlers;
using Paranext.DataProvider.Messages;
using PtxUtils;

namespace Paranext.DataProvider.MessageTransports;

/// <summary>
/// Class to facilitate communication to the Paranext server via the PAPI
/// </summary>
internal sealed class PapiClient : IDisposable
{
    #region Delegates/Constants/Member variables
    private const int CONNECT_TIMEOUT = 30000;
    private const int RECEIVE_BUFFER_LENGTH = 2048;
    private static readonly Encoding s_utf8WithoutBOM = new UTF8Encoding();
    private static readonly Uri s_connectionUri = new("ws://localhost:8876");
    private static readonly JsonSerializerOptions s_serializationOptions;

    private readonly Dictionary<Enum<MessageType>, IMessageHandler> _messageHandlersByMessageType =
        new();
    private readonly ConcurrentDictionary<int, IMessageHandler> _messageHandlersForMyRequests =
        new();
    private readonly ClientWebSocket _webSocket;
    private readonly Thread _messageHandlingThread;
    private readonly CancellationTokenSource _cancellationTokenSource = new();
    private readonly ManualResetEventSlim _messageHandlingComplete = new(false);
    private int _clientId = MessageInitClientConnectorInfo.CLIENT_ID_UNSET;
    private int _nextRequestId = 1;
    private bool _isDisposed = false;
    #endregion

    #region Constructors
    static PapiClient()
    {
        s_serializationOptions = SerializationOptions.CreateSerializationOptions();
        s_serializationOptions.Converters.Add(new MessageConverter());
    }

    public PapiClient()
    {
        _webSocket = new ClientWebSocket();
        _messageHandlingThread = new(HandleMessages);
        _messageHandlersByMessageType[MessageType.Event] = new MessageHandlerEvent();
        _messageHandlersByMessageType[MessageType.Request] =
            new MessageHandlerRequestByRequestType();
    }

    #endregion

    #region Dispose

    public void Dispose()
    {
        // Do not change this code. Put cleanup code in 'Dispose(bool isDisposing)' method
        Dispose(isDisposing: true);
        GC.SuppressFinalize(this);
    }

    // Override finalizer only if 'Dispose(bool isDisposing)' has code to free unmanaged resources
    // https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose
    // ~PapiClient()
    // {
    //     // Do not change this code. Put cleanup code in 'Dispose(bool isDisposing)' method
    //     Dispose(isDisposing: false);
    // }

    private void Dispose(bool isDisposing)
    {
        if (_isDisposed)
            return;

        if (isDisposing)
        {
            _webSocket.Dispose();
            _cancellationTokenSource.Dispose();
            _messageHandlingComplete.Dispose();
        }

        _messageHandlersForMyRequests.Clear();

        _isDisposed = true;
    }

    #endregion

    #region Properties
    /// <summary>
    /// Gets whether connection is open to the server
    /// </summary>
    public bool Connected => !_isDisposed && _webSocket.State == WebSocketState.Open;
    #endregion

    #region Public methods
    /// <summary>
    /// Opens a connection with the server
    /// </summary>
    public async Task<bool> ConnectAsync()
    {
        Console.WriteLine("PapiClient connecting");

        CancellationTokenSource cancelTokenSource = new(CONNECT_TIMEOUT);
        await _webSocket.ConnectAsync(s_connectionUri, cancelTokenSource.Token);

        var message = await ReceiveMessageAsync<MessageInitClient>(CancellationToken.None);
        if (message == null || message.ConnectorInfo == null)
        {
            Console.Error.WriteLine($"Unexpected message while connecting: {message}");
            await DisconnectAsync();
            return false;
        }

        _clientId = message.ConnectorInfo.ClientId;
        await SendMessageAsync(new MessageClientConnect(_clientId), CancellationToken.None);

        _messageHandlingThread.Start();

        Console.WriteLine("PapiClient connected successfully");
        return true;
    }

    /// <summary>
    /// Gracefully closes the connection to the server.
    /// After calling this method, the PapiClient object is no longer valid and should not be used for anything. If you want to reconnect, create a new object.
    /// </summary>
    public async Task DisconnectAsync()
    {
        Console.WriteLine("PapiClient disconnecting");

        // Start a graceful disconnection process before disposing
        _cancellationTokenSource.Cancel();
        _messageHandlingComplete.Set();
        if (!_messageHandlingThread.Join(TimeSpan.FromSeconds(2)))
            Console.Error.WriteLine("Message handling thread did not shut down properly");
        await _webSocket.CloseAsync(
            WebSocketCloseStatus.NormalClosure,
            string.Empty,
            CancellationToken.None
        );
        Dispose();
    }

    /// <summary>
    /// Return once message handling is complete or the provided timeout is reached
    /// </summary>
    /// <param name="timeoutInMS">Number of milliseconds to wait for message handling to complete, or -1 to wait indefinitely</param>
    public void BlockUntilMessageHandlingComplete(int timeoutInMS = -1)
    {
        _messageHandlingComplete.Wait(timeoutInMS);
    }

    /// <summary>
    /// Registers a request handler with the server
    /// </summary>
    /// <param name="requestToHandle">The request to register</param>
    /// <param name="doStuff">Method that is called when the request is received from the server</param>
    /// <param name="responseTimeoutInMS">Number of milliseconds to wait for the registration response to be received</param>
    /// <returns>True if the registration was successful</returns>
    public async Task<bool> RegisterRequestHandlerAsync(
        Enum<RequestType> requestToHandle,
        Func<dynamic, ResponseToRequest> doStuff,
        int responseTimeoutInMS = 1000
    )
    {
        Console.WriteLine($"Registering handler for request type {requestToHandle}...");
        bool registrationSucceeded = false;
        ManualResetEventSlim registrationComplete = new(false);

        var registerRequest = new MessageRequest(
            RequestType.RegisterRequest,
            Interlocked.Increment(ref _nextRequestId),
            new dynamic[] { requestToHandle.ToString(), _clientId }
        );

        _messageHandlersForMyRequests[registerRequest.RequestId] = new MessageHandlerResponse(
            registerRequest,
            (bool success, dynamic? data) =>
            {
                if (!success)
                {
                    Console.Error.WriteLine(
                        $"Failed to register request type \"{requestToHandle}\" with the server"
                    );
                }
                else
                {
                    var responder = (MessageHandlerRequestByRequestType)
                        _messageHandlersByMessageType[MessageType.Request];
                    responder.SetHandlerForRequestType(requestToHandle, doStuff);
                    Console.WriteLine(
                        $"Request type \"{requestToHandle}\" successfully registered with the server"
                    );
                    registrationSucceeded = true;
                }

                registrationComplete.Set();
            }
        );

        await SendMessageAsync(registerRequest, CancellationToken.None);
        if (!registrationComplete.Wait(responseTimeoutInMS))
        {
            Console.Error.WriteLine(
                $"No response came back when registering request type \"{requestToHandle}\""
            );
        }
        return registrationSucceeded;
    }

    /// <summary>
    /// Configure PapiClient to call <paramref name="func"/> whenever an event of type <paramref name="eventType"/> is received.
    /// </summary>
    /// <param name="eventType">Event type to monitor</param>
    /// <param name="func">Function that optionally returns messages to send when an event is received</param>
    public void RegisterEventHandler(Enum<EventType> eventType, Func<dynamic?, Message?> func)
    {
        var msgHandler = (MessageHandlerEvent)_messageHandlersByMessageType[MessageType.Event];
        msgHandler.RegisterEventHandler(eventType, func);
        Console.WriteLine($"Handler for event type \"{eventType}\" successfully registered");
    }

    /// <summary>
    /// Configure PapiClient to no longer call <paramref name="func"/> whenever an event of type <paramref name="eventType"/> is received.
    /// </summary>
    /// <param name="eventType">Event type to monitor</param>
    /// <param name="func">Same function reference previously passed to RegisterEventHandler</param>
    public void UnregisterEventHandler(Enum<EventType> eventType, Func<dynamic?, Message?> func)
    {
        var msgHandler = (MessageHandlerEvent)_messageHandlersByMessageType[MessageType.Event];
        msgHandler.UnregisterEventHandler(eventType, func);
        Console.WriteLine($"Handler for event type \"{eventType}\" successfully unregistered");
    }

    /// <summary>
    /// Send an event message to the server/>.
    /// </summary>
    /// <param name="message">Event message to send</param>
    /// <returns></returns>
    public async Task SendEvent(MessageEvent message)
    {
        await SendMessageAsync(message, CancellationToken.None);
    }
    #endregion

    #region Private helper methods
    /// <summary>
    /// Sends the specified message to the server
    /// </summary>
    /// <param name="message">Message to send</param>
    /// <param name="cancellationToken">Token for cancelling the web socket write operation</param>
    private async Task SendMessageAsync(Message message, CancellationToken cancellationToken)
    {
        if (_webSocket.State != WebSocketState.Open)
            throw new InvalidOperationException("Can not send data when the socket is closed");

        message.SenderId = _clientId;
        string jsonData = JsonSerializer.Serialize(message, s_serializationOptions);
        Console.WriteLine("Sending message over websocket: {0}", jsonData);
        byte[] data = s_utf8WithoutBOM.GetBytes(jsonData);
        await _webSocket.SendAsync(data, WebSocketMessageType.Text, true, cancellationToken);
    }

    /// <summary>
    /// Waits to receive a message from the server
    /// </summary>
    /// <param name="cancellationToken">Token for cancelling the web socket read operation</param>
    /// <typeparam name="TReturn">The expected message return type or use Message if unknown.</typeparam>
    private async Task<TReturn?> ReceiveMessageAsync<TReturn>(CancellationToken cancellationToken)
        where TReturn : Message
    {
        if (_webSocket.State != WebSocketState.Open)
            throw new InvalidOperationException("Can not receive data when the socket is closed");

        using MemoryStream message = new(RECEIVE_BUFFER_LENGTH);

        byte[] buffer = new byte[RECEIVE_BUFFER_LENGTH];
        Memory<byte> bufferMemory = new(buffer);
        ValueWebSocketReceiveResult result;
        do
        {
            result = await _webSocket.ReceiveAsync(bufferMemory, cancellationToken); // Wait forever

            if (result.MessageType == WebSocketMessageType.Binary)
                throw new InvalidOperationException("Can't handle binary data yet.");

            if (result.MessageType == WebSocketMessageType.Close)
            {
                // TODO: Handle close request better
                await DisconnectAsync();
                return null;
            }

            message.Write(buffer, 0, result.Count);
        } while (!result.EndOfMessage);

        string jsonData = s_utf8WithoutBOM.GetString(message.GetBuffer(), 0, (int)message.Position);
        Console.WriteLine("Received message over websocket: {0}", jsonData);
        return JsonSerializer.Deserialize<TReturn>(jsonData, s_serializationOptions);
    }

    /// <summary>
    /// Gets and processes messages coming from the server.
    /// Blocks until the connection is closed
    /// </summary>
    private async void HandleMessages()
    {
        try
        {
            do
            {
                try
                {
                    Console.WriteLine("PapiClient waiting for the next incoming message");
                    var receiveTask = ReceiveMessageAsync<Message>(_cancellationTokenSource.Token);
                    Message? message = await receiveTask;
                    if (message is null)
                    {
                        Console.Error.WriteLine("Received null message!");
                    }
                    else
                    {
                        // Handle each message asynchronously so we can keep receiving more messages
                        _ = Task.Run(() =>
                        {
                            HandleMessage(message);
                        });
                    }
                }
                catch (OperationCanceledException) // Thrown by the websocket when cancelling
                {
                    break;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Exception while handling messages: {ex}");
                }
            } while (!_cancellationTokenSource.IsCancellationRequested && Connected);

            _messageHandlingComplete.Set();
            Console.WriteLine("PapiClient HandleMessages exiting");
        }
        // Don't take down the process if Dispose() ran faster than some of the code here
        catch (ObjectDisposedException) { }
    }

    /// <summary>
    /// Message handler for any kind of message
    /// </summary>
    private async void HandleMessage(Message message)
    {
        try
        {
            if (message is MessageResponse messageResponse)
            {
                HandleMessageResponse(messageResponse);
                return;
            }

            if (_messageHandlersByMessageType.TryGetValue(message.Type, out var messageHandler))
            {
                foreach (var messageToSend in messageHandler.HandleMessage(message))
                {
                    await SendMessageAsync(messageToSend, _cancellationTokenSource.Token);
                }
            }
            else
            {
                Console.Error.WriteLine($"No handler registered for message type: {message.Type}");
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Exception while handling message: {ex}");
        }
    }

    /// <summary>
    /// Message handler for a response to a request we previously sent
    /// </summary>
    private async void HandleMessageResponse(MessageResponse response)
    {
        // Remove, don't just get, the response handler since the request is complete
        if (_messageHandlersForMyRequests.TryRemove(response.RequestId, out var messageHandler))
        {
            foreach (var messageToSend in messageHandler.HandleMessage(response))
            {
                await SendMessageAsync(messageToSend, _cancellationTokenSource.Token);
            }
        }
        else
        {
            Console.Error.WriteLine(
                $"No handler registered for response from request ID: {response.RequestId}"
            );
        }
    }
    #endregion
}

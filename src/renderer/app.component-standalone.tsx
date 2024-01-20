import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './app.component-standalone.scss';
import { WebViewTabProps } from '@shared/models/docking-framework.model';
// import { WebViewType } from '@shared/models/web-view.model';
import { getWebView, onDidAddWebView } from '@renderer/services/web-view.service-host';
import { useEffect, useState } from 'react';
import WebView from './components/web-view.component';
import PlatformPanel from './components/docking/platform-panel.component';
import { FoodBankSharp } from '@mui/icons-material';

function Main() {
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  const [webViewProps, setWebViewProps] = useState({} as WebViewTabProps);

  const webViewType =
    window.location.pathname.substring(1).length > 1
      ? window.location.pathname.substring(1).replace('_', '.')
      : 'paranextExtensionDashboard.react2';

  const state = Object.fromEntries(new URL(window.location.toString()).searchParams);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(state));

  onDidAddWebView((addWebViewEvent) => {
    if (addWebViewEvent.webView.webViewType === webViewType) {
      Object.entries(state).forEach(([key, value]) =>
        window.setWebViewStateById(addWebViewEvent.webView.id, key, value),
      );
      setWebViewProps({
        id: addWebViewEvent.webView.id,
        webViewType: addWebViewEvent.webView.webViewType,
        title: addWebViewEvent.webView.title,
        content: addWebViewEvent.webViewFull?.content ?? '',
        contentType: addWebViewEvent.webView.contentType,
        allowScripts: true,
        allowSameOrigin: true,
      });
    }
  });

  useEffect(() => {
    async function getWebViewProps() {
      await getWebView(webViewType);
    }
    getWebViewProps();
  }, []);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(webViewProps));
  return (
    <PlatformPanel>
      <WebView {...webViewProps} />
    </PlatformPanel>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Main />} />
      </Routes>
    </Router>
  );
}

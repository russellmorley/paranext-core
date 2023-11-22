using System.Collections.Concurrent;
using Paranext.DataProvider.JsonUtils;
using Paratext.Data;
using Paratext.Data.Users;

namespace Paranext.DataProvider.Projects;

/// <summary>
/// Direct access methods to the file system for project directories
/// </summary>
internal partial class LocalProjects
{
    private const UnixFileMode UNIX_FILE_MODE =
        UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute;

    // Inside of each project's "home" directory, these are the subdirectories and files
    protected const string PROJECT_SUBDIRECTORY = "project";
    private const string PROJECT_METADATA_FILE = "meta.json";

    // Inside of the project subdirectory, this is the subdirectory for Paratext projects
    protected const string PARATEXT_DATA_SUBDIRECTORY = "paratext";

    private readonly ConcurrentDictionary<string, ProjectDetails> _projectDetailsMap = new();

    // All project directories are subdirectories of this
    private string? _projectRootFolder;
    protected virtual string ProjectRootFolder
    {
        get
        {
            if (_projectRootFolder == null)
            {
                _projectRootFolder = Path.Join(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    ".platform.bible",
                    "projects"
                );
            }
            ;
            return _projectRootFolder;
        }
    }

    public virtual void Initialize()
    {
        if (!_projectDetailsMap.IsEmpty)
            return;

        CreateDirectory(ProjectRootFolder);

        foreach (var projectDetails in LoadAllProjectDetails())
        {
            if (projectDetails.Metadata.ProjectStorageType != ProjectStorageType.ParatextFolders)
                continue;

            try
            {
                AddProjectToMaps(projectDetails);
                Console.WriteLine($"Loaded project metadata: {projectDetails}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to load project for {projectDetails}: {ex}");
            }
        }
    }

    public virtual IList<ProjectDetails> GetAllProjectDetails()
    {
        return _projectDetailsMap.Values.ToList();
    }

    public virtual ProjectDetails GetProjectDetails(string projectId)
    {
        return _projectDetailsMap[projectId.ToUpperInvariant()];
    }

    public virtual ScrText GetParatextProject(string projectId)
    {
        return ScrTextCollection.GetById(HexId.FromStr(projectId));
    }

    public void SaveProjectMetadata(ProjectMetadata metadata, bool overwrite = false)
    {
        var projectHomeDir = GetProjectDir(metadata.Name, metadata.ID);
        SaveProjectMetadata(projectHomeDir, metadata, overwrite);
    }

    protected void SaveProjectMetadata(
        string projectHomeDir,
        ProjectMetadata metadata,
        bool overwrite
    )
    {
        var projectContentsDir = Path.Join(projectHomeDir, PROJECT_SUBDIRECTORY);
        var metadataFilePath = Path.Join(projectHomeDir, PROJECT_METADATA_FILE);

        if (File.Exists(metadataFilePath) && !overwrite)
            throw new InvalidOperationException(
                "Cannot overwrite metadata unless the overwrite flag is true"
            );

        CreateDirectory(projectContentsDir);

        File.WriteAllText(metadataFilePath, ProjectMetadataConverter.ToJsonString(metadata));
        AddProjectToMaps(new ProjectDetails(metadata, projectHomeDir));
    }

    protected void CreateDirectory(string dir)
    {
        if (Directory.Exists(dir))
            return;

        if (OperatingSystem.IsWindows())
            Directory.CreateDirectory(dir);
        else
            Directory.CreateDirectory(dir, UNIX_FILE_MODE);
    }

    public void LoadProject(string projectName, string projectID)
    {
        var dir = GetProjectDir(projectName, projectID);
        var projectMetadata =
            LoadProjectMetadata(dir, out string errorMessage) ?? throw new Exception(errorMessage);
        AddProjectToMaps(new ProjectDetails(projectMetadata, dir));
    }

    private string GetProjectDir(string projectName, string projectID)
    {
        return Path.Join(ProjectRootFolder, $"{projectName}_{projectID}");
    }

    private void AddProjectToMaps(ProjectDetails projectDetails)
    {
        var projectPath = Path.Join(
            projectDetails.HomeDirectory,
            PROJECT_SUBDIRECTORY,
            projectDetails.Metadata.ProjectType
        );

        var id = projectDetails.Metadata.ID;
        Console.WriteLine(
            _projectDetailsMap.ContainsKey(id)
                ? $"Replacing Paratext project in map: {id} = {projectPath}"
                : $"Adding Paratext project in map: {id} = {projectPath}"
        );
        _projectDetailsMap[id.ToUpperInvariant()] = projectDetails;

        if (projectDetails.Metadata.ProjectType == ProjectMetadata.PARATEXT)
        {
            ProjectName projectName = new ProjectName
            {
                ShortName = projectDetails.Metadata.Name,
                ProjectPath = projectPath
            };
            ScrTextCollection.Add(new ScrText(projectName, RegistrationInfo.DefaultUser));
        }
    }

    /// <summary>
    /// Return projects that are available on disk on the local machine
    /// </summary>
    /// <returns>Enumeration of (ProjectMetadata, project directory) tuples for all projects</returns>
    private IEnumerable<ProjectDetails> LoadAllProjectDetails()
    {
        foreach (var dir in Directory.EnumerateDirectories(ProjectRootFolder))
        {
            ProjectMetadata? projectMetadata;
            string errorMessage;
            try
            {
                projectMetadata = LoadProjectMetadata(dir, out errorMessage);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error while getting project metadata from {dir}: {ex}");
                continue;
            }

            if (projectMetadata == null)
                Console.WriteLine(errorMessage);
            else
                yield return new ProjectDetails(projectMetadata, dir);
        }
    }

    private static ProjectMetadata? LoadProjectMetadata(
        string projectHomeDir,
        out string errorMessage
    )
    {
        if (!Directory.Exists(Path.Combine(projectHomeDir, PROJECT_SUBDIRECTORY)))
        {
            errorMessage = $"Ignoring project without \"project\" subdir: {projectHomeDir}";
            return null;
        }

        string metadataFilePath = Path.Combine(projectHomeDir, PROJECT_METADATA_FILE);
        if (!File.Exists(metadataFilePath))
        {
            errorMessage = $"Ignoring project without metadata file: {projectHomeDir}";
            return null;
        }

        string json = File.ReadAllText(metadataFilePath);
        if (!ProjectMetadataConverter.TryGetMetadata(json, out var metadata, out string error))
        {
            errorMessage = $"Invalid project metadata at {metadataFilePath}: {error}";
            return null;
        }

        errorMessage = "";
        return metadata;
    }
}

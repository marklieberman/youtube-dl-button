using System;
using System.Diagnostics;

namespace YoutubeDlButton
{
    class YoutubeDlRunner : IDisposable
    {
        private Process process;
        private bool cancelled = false;

        public int JobId { get; set; }

        public YoutubeDlProps Props { get; set; }
                
        public event Action<YoutubeDlRunner, string> Output;
        public event Action<YoutubeDlRunner, int> Ended;

        /// <summary>
        /// Start a new instance of youtube-dl.exe.
        /// </summary>
        public void Start()
        {
            if (cancelled)
            {
                throw new InvalidOperationException("Operation was cancelled");
            }

            if (process != null)
            {
                throw new InvalidOperationException("Already started");
            }

            try
            {
                // Create a cookie jar if cookies are provided.
                Props.CreateCookieJar();

                // Start an instance of youtube-dl.
                process = Process.Start(new ProcessStartInfo
                {
                    FileName = Environment.ExpandEnvironmentVariables(Props.ExePath),
                    Arguments = Props.ToArguments(),
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    // This is necessary to avoid hanging youtube-dl.exe even though we never use it.
                    RedirectStandardInput = true
                });

                // Get notified when the process exits.
                process.EnableRaisingEvents = true;
                process.Exited += OnProcessExited;
                
                // Asynchronously read from process output.
                process.OutputDataReceived += OnOutputReceived;
                process.ErrorDataReceived += OnOutputReceived;
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
            }
            catch (Exception e)
            {
                // Send the error message back to the addon.
                Output?.Invoke(this, string.Format("Error starting youtube-dl process: {0}", e.Message));
            }
            finally
            {
                // Delete the cookie jar when finished.
                Props.RemoveCookieJar();
            }
        }

        /// <summary>
        /// Terminate the youtube-dl.exe process if it is running. The Ended event will not be invoked.
        /// </summary>
        public void Cancel()
        {
            if (!cancelled)
            {
                cancelled = true;

                // The caller may assume the process ended.
                Output = null;
                Ended = null;

                if (!process?.HasExited ?? false)
                {
                    // process.Kill() was sufficient for youtube-dl, but yt-dlp uses child processes.
                    ProcessKiller.KillWithChildren(process.Id);
                }
            }
        }

        /// <summary>
        /// Invoked when youtube-dl.exe exits.
        /// </summary>
        private void OnProcessExited(object sender, EventArgs e)
        {
            // Invoke the ended callback when the process exits.
            Ended?.Invoke(this, process?.ExitCode ?? 1);
        }

        /// <summary>
        /// Invoked when youtube-dl.exe writes to its stdout or stderr.
        /// </summary>
        private void OnOutputReceived(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {                
                Debug.WriteLine(e.Data);
                Output?.Invoke(this, e.Data);
            }
        }

        public void Dispose()
        {
            if (process != null)
            {
                process.Dispose();
                process = null;
            }
        }
    }
}

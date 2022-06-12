using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text.RegularExpressions;

namespace YoutubeDlButton
{
    class YoutubeDlRunner : IDisposable
    {
        // Matches log output that describes a file being downloaded.
        private static Regex LogDownloadFile = new Regex(
            @"^\[download\] Destination: (.+)$", 
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Matches log output that describes a file already being downloaded.
        private static Regex LogAlreadyDownloadedFile = new Regex(
            @"^\[download\] (.+) has already been downloaded$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Matches log output that describes a file being deleted.
        private static Regex LogDeleteFile = new Regex(
            @"^Deleting original file (.+) \(pass -k to keep\)$", 
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Matches log output that describes a new file created by merging.
        private static Regex LogMergingInto = new Regex(
            @"^\[Merger\] Merging formats into ""(.+)""$", 
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        /// <summary>
        /// Exit codes to report to the frontend.
        /// These are not youtube-dl exit codes.
        /// </summary>
        public enum ExitCodes
        {
            Success = 0,
            Error = 253,
            JobCancelled = 254,
            JobNotFound = 255
        }

        private Process youtubeDlProcess;
        private Process postProcess;
        private bool cancelled = false;

        public int JobId { get; set; }

        public YoutubeDlProps Props { get; set; }

        public List<string> Files = new List<string>();
                
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

            if (youtubeDlProcess != null)
            {
                throw new InvalidOperationException("Already started");
            }

            try
            {
                // Create a cookie jar if cookies are provided.
                Props.CreateCookieJar();

                // Start an instance of youtube-dl.
                youtubeDlProcess = Process.Start(new ProcessStartInfo
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
                youtubeDlProcess.EnableRaisingEvents = true;
                youtubeDlProcess.Exited += OnYoutubeDlProcessExited;
                
                // Asynchronously read from process output.
                youtubeDlProcess.OutputDataReceived += OnYoutubeDlOutputReceived;
                youtubeDlProcess.ErrorDataReceived += OnYoutubeDlOutputReceived;
                youtubeDlProcess.BeginOutputReadLine();
                youtubeDlProcess.BeginErrorReadLine();
            }
            catch (Exception e)
            {
                // Send the error message back to the addon.
                Output?.Invoke(this, string.Format("Error starting youtube-dl process: {0}", e.Message));
                Ended?.Invoke(this, (int)ExitCodes.Error);
            }
            finally
            {
                // Delete the cookie jar when finished.
                Props.RemoveCookieJar();
            }
        }
        
        /// <summary>
        /// Invoke the post processing script.
        /// </summary>
        public void PostProcess ()
        {
            if (cancelled)
            {
                throw new InvalidOperationException("Operation was cancelled");
            }

            try
            {   
                string filename = Environment.ExpandEnvironmentVariables(Props.PostProcessScript);
                string arguments = string.Join(" ", Files.Select(f => "\"" + f + "\"").ToArray());
                Output?.Invoke(this, string.Format("Starting post process with: {0} {1}", filename, arguments));

                // Invoke the post processing script.
                postProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = filename,
                    Arguments = arguments,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = true
                });

                // Get notified when the process exits.
                postProcess.EnableRaisingEvents = true;
                postProcess.Exited += OnPostProcessDlProcessExited;

                // Asynchronously read from process output.
                postProcess.OutputDataReceived += OnPostProcessOutputReceived;
                postProcess.ErrorDataReceived += OnPostProcessOutputReceived;
                postProcess.BeginOutputReadLine();
                postProcess.BeginErrorReadLine();
            }
            catch (Exception e)
            {
                // Send the error message back to the addon.
                Output?.Invoke(this, string.Format("Error starting post process: {0}", e.Message));
                Ended?.Invoke(this, (int)ExitCodes.Error);
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

                if (!youtubeDlProcess?.HasExited ?? false)
                {
                    // process.Kill() was sufficient for youtube-dl, but yt-dlp uses child processes.
                    ProcessKiller.KillWithChildren(youtubeDlProcess.Id);
                }

                if (!postProcess?.HasExited ?? false)
                {
                    ProcessKiller.KillWithChildren(postProcess.Id);
                }
            }
        }

        /// <summary>
        /// Invoked when youtube-dl.exe exits.
        /// </summary>
        private void OnYoutubeDlProcessExited(object sender, EventArgs e)
        {
            // Begin post-processing if youtube-dl exited cleanly.
            if (((youtubeDlProcess?.ExitCode ?? 1) == 0) && !String.IsNullOrEmpty(Props.PostProcessScript))
            {
                PostProcess();
            }
            else
            {
                // Invoke the ended callback when the process exits.
                var exitCode = ((youtubeDlProcess?.ExitCode ?? 1) == 0) ? 0 : (int)ExitCodes.Error;
                Ended?.Invoke(this, exitCode);
            }            
        }

        /// <summary>
        /// Invoked when the post process script exits.
        /// </summary>
        private void OnPostProcessDlProcessExited(object sender, EventArgs e)
        {
            // Invoke the ended callback when the process exits.
            var exitCode = ((postProcess?.ExitCode ?? 1) == 0) ? 0 : (int)ExitCodes.Error;
            Ended?.Invoke(this, postProcess?.ExitCode ?? 1);
        }

        /// <summary>
        /// Invoked when youtube-dl.exe writes to its stdout or stderr.
        /// </summary>
        private void OnYoutubeDlOutputReceived(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                string output = e.Data.Trim();

                // Log output indicates a file was downloaded.
                Match match = LogDownloadFile.Match(output);
                if (match.Success)
                {
                    Files.Add(match.Groups[1].Value);
                }

                // Log output indicates a file was already downloaded.
                match = LogAlreadyDownloadedFile.Match(output);
                if (match.Success)
                {
                    Files.Add(match.Groups[1].Value);
                }

                // Log output indicates a file was deleted.
                match = LogDeleteFile.Match(output);
                if (match.Success)
                {
                    Files.Remove(match.Groups[1].Value);
                }

                // Log output indicates a file was created by merging.
                match = LogMergingInto.Match(output);
                if (match.Success)
                {
                    Files.Add(match.Groups[1].Value);
                }

                Debug.WriteLine(output);
                Output?.Invoke(this, output);
            }
        }

        /// <summary>
        /// Invoked when the post process script writes to its stdout or stderr.
        /// </summary>
        private void OnPostProcessOutputReceived(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                string output = e.Data.Trim();
                Debug.WriteLine(output);
                Output?.Invoke(this, output);
            }
        }

        public void Dispose()
        {
            if (youtubeDlProcess != null)
            {
                youtubeDlProcess.Dispose();
                youtubeDlProcess = null;
            }
        }
    }
}

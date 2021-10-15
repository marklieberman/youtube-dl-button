﻿using System;
using System.Diagnostics;

namespace YoutubeDlButton
{
    class YoutubeDlRunner
    {
        private Process process;
        private bool cancel = false;

        public int JobId { get; set; }

        public YoutubeDlProps Props { get; set; }
                
        public event Action<YoutubeDlRunner, string> Output;
        public event Action<YoutubeDlRunner, int> Ended;

        public void Start()
        {
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
                    RedirectStandardError = true
                });

                // Asynchronously read from process standard output.
                process.OutputDataReceived += OnOutputReceived;
                process.BeginOutputReadLine();

                // Asynchronously read from process standard error.
                process.ErrorDataReceived += OnOutputReceived;
                process.BeginErrorReadLine();

                if (cancel)
                {
                    throw new Exception("Job cancelled");
                }
                else
                {
                    // Block until the process is done.
                    process.WaitForExit();
                }
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

            // Invoke the ended callback when the process exits.
            Ended?.Invoke(this, process?.ExitCode ?? 1);
        }

        public void Cancel()
        {
            cancel = true;
            if (!process?.HasExited ?? false)
            {
                // process.Kill() was sufficient for youtube-dl, but yt-dlp uses child processes.
                ProcessKiller.KillWithChildren(process.Id);
            }
        }

        private void OnOutputReceived(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data))
            {                
                Debug.WriteLine(e.Data);
                Output?.Invoke(this, e.Data);
            }
        }
        
    }
}

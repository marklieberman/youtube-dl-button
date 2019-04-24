using System;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace YoutubeDlButton
{
    class YoutubeDlRunner
    {
        private Regex interestingOutput = new Regex(
            @"^\[download|ffmpeg\]", 
            RegexOptions.Compiled | RegexOptions.IgnoreCase);
        
        private Process process;

        public int JobId { get; set; }

        public YoutubeDlProps Props { get; set; }
                
        public event Action<YoutubeDlRunner, string> Output;
        public event Action<YoutubeDlRunner, int> Ended;

        public void Start()
        {
            try
            {
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

                // Block until the process is done.
                process.WaitForExit();
            }
            catch (Exception e)
            {
                // Send the error message back to the addon.
                Output?.Invoke(this, String.Format("Error starting youtube-dl process: {0}", e.Message));
            }

            // Invoke the ended callback when the process exits.
            Ended?.Invoke(this, process?.ExitCode ?? 1);
        }

        public void Cancel()
        {
            if (!process?.HasExited ?? false)
            {
                process.Kill();
            }
        }

        private void OnOutputReceived(object sender, DataReceivedEventArgs e)
        {
            if (!String.IsNullOrEmpty(e.Data))
            {                
                Debug.WriteLine(e.Data);
                Output?.Invoke(this, e.Data);
            }
        }        
    }
}

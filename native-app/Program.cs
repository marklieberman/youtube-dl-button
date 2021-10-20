using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using YoutubeDlButton.Messages;

namespace YoutubeDlButton
{
    class Program
    {
        static readonly object Lock = new object();

        static readonly ConcurrentDictionary<int,YoutubeDlRunner> jobs = new ConcurrentDictionary<int,YoutubeDlRunner>();

        public static async Task Main()
        {
#if DEBUG
            Debugger.Launch();
#endif

            while (true)
            {
                // Read messages from the addon over standard input.
                var message = await ReadMessage();
                if (message != null)
                {
                    OnMessage(message);
                }
            }
        }

        /// <summary>
        /// Read a message from standard input.
        /// </summary>
        /// <returns></returns>
        static async Task<JObject> ReadMessage ()
        {
            var stdin = Console.OpenStandardInput();
            using (var reader = new BinaryReader(stdin, Encoding.UTF8))
            {
                var lengthBytes = new byte[4];
                await stdin.ReadAsync(lengthBytes, 0, 4);
                var length = BitConverter.ToInt32(lengthBytes, 0);
                if (length > 0)
                {
                    var bodyBuffer = new byte[length];
                    await stdin.ReadAsync(bodyBuffer, 0, length);
                    var json = Encoding.UTF8.GetString(bodyBuffer);
                    return JObject.Parse(json);
                }
            }
            return null;
        }
        
        /// <summary>
        /// Write a message to standard output.
        /// </summary>
        /// <param name="message"></param>
        static void Write(object message)
        {
            var json = JObject.FromObject(message).ToString(Formatting.None);
            var jsonBytes = Encoding.UTF8.GetBytes(json);

            // Use of stdout should be thread-safe.
            lock (Lock)
            {
                var stdout = Console.OpenStandardOutput();
                  
                // Write the length header.
                stdout.WriteByte((byte)((jsonBytes.Length >> 0) & 0xFF));
                stdout.WriteByte((byte)((jsonBytes.Length >> 8) & 0xFF));
                stdout.WriteByte((byte)((jsonBytes.Length >> 16) & 0xFF));
                stdout.WriteByte((byte)((jsonBytes.Length >> 24) & 0xFF));

                // Write the message body.
                stdout.Write(jsonBytes, 0, jsonBytes.Length);

                stdout.Flush();
                stdout.Close();
            }
        }

        /// <summary>
        /// Handle messages from the browser.
        /// </summary>
        /// <param name="message"></param>
        static void OnMessage(JObject message) {
            switch (message["topic"].Value<string>())
            {
                case "create-job":
                    OnCreateJob(message.ToObject<Message<CreateJob>>());
                    break;
                case "cancel-job":
                    OnCancelJob(message.ToObject<Message<CancelJob>>());
                    break;
            }
        }

        /// <summary>
        /// Invoked when a new job message is received.
        /// </summary>
        /// <param name="message"></param>
        static void OnCreateJob(Message<CreateJob> message)
        {
            YoutubeDlRunner runner = new YoutubeDlRunner
            {
                JobId = message.Data.JobId,
                Props = message.Data.Props
            };
            
            runner.Output += (r, output) => {
                Write(new Message<JobOutput>("job-output", new JobOutput
                {
                    JobId = r.JobId,
                    Output = output
                }));
            };

            runner.Ended += (r, exitCode) => {
                Write(new Message<JobEnded>("job-ended", new JobEnded
                {
                    JobId = r.JobId,
                    ExitCode = exitCode
                }));

                r.Dispose();

                jobs.TryRemove(r.JobId, out _);                
            };

            jobs.TryAdd(runner.JobId, runner);

            runner.Start();

            // Send a message back with the job commandline arguments.
            Write(new Message<JobOutput>("job-started", new JobOutput
            {
                JobId = message.Data.JobId,
                Output = message.Data.Props.ToArguments()
            }));
        }

        /// <summary>
        /// Invoked when a cancel job message is received.
        /// </summary>
        /// <param name="message"></param>
        static void OnCancelJob(Message<CancelJob> message)
        {
            // youtube-dl does not document any exist codes besides 0 and 1.
            // To avoid leaving orphaned jobs in the frontend, we will report the following extra codes:
            //   255: The job was not found.
            //   254: The job was found and cancelled.
            var exitCode = 255;

            jobs.TryGetValue(message.Data.JobId, out YoutubeDlRunner runner);
            if (runner != null)
            {
                // Found the job.
                exitCode = 254;
                runner.Cancel();
                runner.Dispose();
                jobs.TryRemove(runner.JobId, out _);
            } 

            // Tell the frontend the cancellation request was handled.
            Write(new Message<JobEnded>("job-ended", new JobEnded
            {
                JobId = message.Data.JobId,
                ExitCode = exitCode
            }));
        }
    }
}

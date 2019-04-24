using Newtonsoft.Json;
using System;

namespace YoutubeDlButton.Messages
{
    public class JobEnded
    {
        [JsonProperty("jobId")]
        public int JobId
        {
            get; set;
        }

        [JsonProperty("exitCode")]
        public int ExitCode
        {
            get; set;
        }
    }
}

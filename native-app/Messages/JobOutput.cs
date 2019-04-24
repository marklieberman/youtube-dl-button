using Newtonsoft.Json;
using System;

namespace YoutubeDlButton.Messages
{
    public class JobOutput
    {
        [JsonProperty("jobId")]
        public int JobId
        {
            get; set;
        }

        [JsonProperty("output")]
        public string Output
        {
            get; set;
        }
    }
}

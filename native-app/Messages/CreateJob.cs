using Newtonsoft.Json;
using System;

namespace YoutubeDlButton.Messages
{
    public class CreateJob
    {
        [JsonProperty("jobId")]
        public int JobId
        {
            get; set;
        }

        [JsonProperty("props")]
        public YoutubeDlProps Props
        {
            get; set;
        }
    }
}

using Newtonsoft.Json;
using System;

namespace YoutubeDlButton.Messages
{
    public class CancelJob
    {
        [JsonProperty("jobId")]
        public int JobId
        {
            get; set;
        }
    }
}

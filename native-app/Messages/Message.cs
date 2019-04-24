using Newtonsoft.Json;
using System;

namespace YoutubeDlButton.Messages
{
    partial class Message<T>
    {
        [JsonProperty("topic")]
        public string Topic
        {
            get; set;
        }

        [JsonProperty("data")]
        public T Data
        {
            get; set;
        }

        public Message() {}

        public Message(string topic, T data)
        {
            this.Topic = topic;
            this.Data = data;
        }        

    }
}

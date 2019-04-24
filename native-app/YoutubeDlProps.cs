using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;

namespace YoutubeDlButton
{
    public class YoutubeDlProps
    {
        [JsonProperty("exePath")]
        public string ExePath { get; set; }

        [JsonProperty("saveIn")]
        public string SaveIn { get; set; } = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

        [JsonProperty("template")]
        public string Template { get; set; }

        [JsonProperty("videoUrl")]
        public string VideoUrl { get; set; }

        [JsonProperty("format")]
        public string Format { get; set; }

        [JsonProperty("customArgs")]
        public string CustomArgs { get; set; }

        [JsonProperty("restrictFilenames")]
        public Boolean RestrictFilenames { get; set; } = false;

        /// <summary>
        /// Create an argument string from the properties.
        /// </summary>
        public string ToArguments()
        {
            var args = new List<String>();
            
            if (RestrictFilenames)
            {
                args.Add("--restrict-filenames");
            }

            if (!String.IsNullOrEmpty(SaveIn) || !String.IsNullOrEmpty(Template))
            {
                args.Add(String.Format("--output \"{0}\"", Path.Combine(SaveIn ?? "", Template ?? "")));                
            }

            if (!String.IsNullOrEmpty(Format))
            {
                args.Add(String.Format("--format {0}", Format));
            }

            if (!String.IsNullOrEmpty(CustomArgs))
            {
                args.Add(CustomArgs);
            }

            args.Add(VideoUrl);

            return String.Join(" ", args.ToArray());
        }
    }
}

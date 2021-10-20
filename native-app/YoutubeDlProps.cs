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

        [JsonProperty("updateExe")]
        public bool UpdateExe { get; set; }

        [JsonProperty("saveIn")]
        public string SaveIn { get; set; } = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

        [JsonProperty("template")]
        public string Template { get; set; }

        [JsonProperty("videoUrl")]
        public string VideoUrl { get; set; }

        [JsonProperty("format")]
        public string Format { get; set; }

        [JsonProperty("cookieJar")]
        public string CookieJar { get; set; }

        [JsonProperty("customArgs")]
        public string CustomArgs { get; set; }

        [JsonProperty("restrictFilenames")]
        public bool RestrictFilenames { get; set; } = false;

        private string cookieJarPath;

        /// <summary>
        /// Write the CookieJar to a temporary file.
        /// </summary>
        public void CreateCookieJar()
        {
            if (!string.IsNullOrEmpty(CookieJar))
            {
                cookieJarPath = Path.GetTempFileName();
                File.WriteAllText(cookieJarPath, CookieJar);
            }
        }

        /// <summary>
        /// Delete the temporary CookieJar file.
        /// </summary>
        public void RemoveCookieJar()
        {
            if (!string.IsNullOrEmpty(cookieJarPath) && File.Exists(cookieJarPath))
            {
                File.Delete(cookieJarPath);
                cookieJarPath = null;                
            }
        }

        /// <summary>
        /// Create an argument string from the properties.
        /// </summary>
        public string ToArguments()
        {
            if (UpdateExe)
            {
                return "--update";
            }

            var args = new List<string>();

            if (RestrictFilenames)
            {
                args.Add("--restrict-filenames");
            }

            if (!string.IsNullOrEmpty(SaveIn) || !string.IsNullOrEmpty(Template))
            {
                args.Add(string.Format("--output \"{0}\"", Path.Combine(SaveIn ?? "", Template ?? "")));                
            }

            if (!string.IsNullOrEmpty(Format))
            {
                args.Add(string.Format("--format {0}", Format));
            }

            if (!string.IsNullOrEmpty(cookieJarPath))
            {
                args.Add(string.Format("--cookies {0}", cookieJarPath));
            }

            if (!string.IsNullOrEmpty(CustomArgs))
            {
                args.Add(CustomArgs);
            }

            args.Add(VideoUrl);

            return string.Join(" ", args.ToArray());
        }
    }
}

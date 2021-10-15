using System;
using System.Diagnostics;
using System.Management;

namespace YoutubeDlButton
{
    class ProcessKiller
    {
        public static void KillWithChildren(int pid)
        {
            ManagementObjectSearcher processSearcher = new ManagementObjectSearcher("Select * From Win32_Process Where ParentProcessID=" + pid);
            ManagementObjectCollection processCollection = processSearcher.Get();

            try
            {
                Process process = Process.GetProcessById(pid);
                if (!process.HasExited)
                {
                    process.Kill();
                }
            }
            catch (ArgumentException)
            {
                // Process already exited.
            }

            if (processCollection != null)
            {
                foreach (ManagementObject mo in processCollection)
                {
                    // Recursively kill child processes.
                    KillWithChildren(Convert.ToInt32(mo["ProcessID"])); 
                }
            }
        }
    }
}

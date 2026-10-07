using DEDrake;
using EPiServer.ServiceLocation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using Microsoft.Extensions.Options;

namespace ANA.Site.Settings
{
   
    [ServiceConfiguration(typeof(IAppSettings), Lifecycle = ServiceInstanceScope.Singleton)]
    public sealed class AppSettings : IAppSettings
    {
        private string _buildId;
        public string BuildId
        {
            get
            {
                if (string.IsNullOrWhiteSpace(_buildId))
                {
                    BuildId = ShortGuid.NewGuid().Guid.ToString();
                }

                return _buildId;
            }
            set => _buildId = value;
        }
        public string MediaPathFormat { get; set; }
        public string MediaPathPrefix
        {
            get
            {
                return string.Format(MediaPathFormat, BuildId);
            }
        }
        public string AssetPathPrefix
        {
            get
            {
                return "/assets/";
                // return $"/~{BuildId}/assets/";
            }
        }
        [ConfigurationKeyName("SSO:URL")]
        public string SSOUrl { get; set; }
        [ConfigurationKeyName("SSO:LogoutUrl")]
        public string LogoutUrl { get; set; }
        public string DisplayGridOverlay { get; set; }
        public string ShuffleexchangeAPI { get; set; }
        public int BulkOrderEnrollmentsLimit { get; set; }
        public int UploadFileSizeLimit { get; set; }
        public int AwardsPageSize { get; set; }
        public int EnrollmentWithdrawalDaysLimit { get; set; }
        public string ProductExportDBConnectionString { get; set; }
        public int D2LAPILogsWithdrawalDaysLimit { get; set; }       
        public string DownloadTemplateFilename { get; set; }
        public string WorksheetName { get; set; }
        public string ExportToCsvFileName { get; set; }
        public int EBookDefaultExpiryHours { get; set; }
        public string CampaignIdSessionKey { get; set; }
    }

    public static class AppSettingsExtensions 
    {
        public static void BindAppSettings(this IServiceCollection  services, IConfiguration configuration)
        {
            services.Configure<AppSettings>(configuration);
            services.AddSingleton<IAppSettings>(sp => sp.GetRequiredService<IOptions<AppSettings>>().Value);
        }
    }

}
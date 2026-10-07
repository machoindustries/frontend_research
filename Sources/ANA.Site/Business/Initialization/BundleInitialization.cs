using JavaScriptEngineSwitcher.Extensions.MsDependencyInjection;
using JavaScriptEngineSwitcher.V8;
using Microsoft.Extensions.DependencyInjection;
using WebOptimizer;

namespace ANA.Site.Business.Initialization
{
    public static class BundleInitialization
    {
        public const string STYLES_PATH = "/styles/";
        public const string BUNDLES_PATH = "/bundles/";

        public static IServiceCollection RegisterBundles(this IServiceCollection services)
        {
            services.AddJsEngineSwitcher(options => options.DefaultEngineName = V8JsEngine.EngineName)
                .AddV8();

            services.AddWebOptimizer(
                pipeline =>
                {
                    AddCssBundles(pipeline);
                    AddScriptBundles(pipeline);
                }
            );

            return services;
        }

        public static void AddScriptBundles(IAssetPipeline pipeline)
        {
            pipeline.AddJavaScriptBundle(BUNDLES_PATH + "jquery",
                "/assets/js/jquery.min.js");

            pipeline.AddJavaScriptBundle(BUNDLES_PATH + "moderniz",
                "/assets/js/modernizr-custom.js");

            pipeline.AddJavaScriptBundle(BUNDLES_PATH + "bootstrap",
                "/Scripts/bootstrap*");

            pipeline.AddJavaScriptBundle(BUNDLES_PATH + "js",
                "/Scripts/js/*.js");
        }

        public static void AddCssBundles(IAssetPipeline pipeline)
        {
            pipeline.AddCssBundle(STYLES_PATH + "screen",
                "/assets/css/screen.css");

            pipeline.AddCssBundle(STYLES_PATH + "print",
                "/assets/css/print.css");

            pipeline.AddCssBundle(STYLES_PATH + "bundled",
                "/Styles/style.css");
        }
    }
}

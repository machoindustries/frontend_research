using EPiServer.Cms.TinyMce;
using EPiServer.Cms.TinyMce.Core;
using EPiServer.ServiceLocation;
using Microsoft.Extensions.DependencyInjection;

namespace ANA.Site.Business.Initialization
{
    public static class CustomizedTinyMceExtensions
    {
        public static IServiceCollection AddTinyMceConfiguration(this IServiceCollection services)
        {
            string[] css = { "/assets/css/editor.css", "/assets/Ojin/css/ojin.css", "/assets/css/editor-fix.css", "/Hub/Static/assets/css/editor/custom.css" };

            services.AddTinyMce();
            services.Configure<TinyMceConfiguration>(config =>
            {
                config.Default()

                    .AddPlugin("importcss media wordcount anchor table code searchreplace")
                     //.Toolbar("table | undo redo | cut copy paste pastetext | superscript subscript | searchreplace | formatselect | styleselect | epi-personalized-content epi-link anchor numlist bullist indent outdent | bold italic underline | alignleft aligncenter alignright alignjustify | image epi-image-editor media code | epi-dnd-processor | removeformat | fullscreen")
                     .Toolbar("table | removeformat | blocks | epi-link anchor image epi-image-editor media epi-personalized-content | cut copy paste pastetext | fullscreen code | bold italic | bullist numlist | styles | undo redo superscript subscript | searchreplace underline alignleft aligncenter alignright alignjustify")
                     .ContentCss(css)
                    .AddSetting("table_grid",false)
                    .AddSetting("extended_valid_elements", "script[language|type|src]")

                    .Height(400)
                    .Width(600);
            });

            return services;
        }
    }
}
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using EPiServer;
using EPiServer.Core;
using EPiServer.Core.Routing;
using EPiServer.Security;
using EPiServer.ServiceLocation;
using EPiServer.Web;
using EPiServer.Web.Routing;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace ANA.Site.Business.Initialization;

public class CdnMiddleware
{
    private static readonly string CdnPrefix = "~";
    public static string StaticAssetPath = "/assets/";
    public static object CdnRequest = new();

    private static bool CdnEnabled
    {
        get {
            var appSettings = _configuration.Service.GetSection("appSettings");
            return appSettings.Exists() && appSettings["cdn:Enabled"] != null && appSettings["cdn:Enabled"].Equals("true");
        }
    }
    private static readonly string[] _mediaPaths = { "contentassets", "siteassets", "globalassets" };
    private static Injected<IContentLoader> Loader;
    private static Injected<IContentUrlResolverEvents> ContentRouteEvents;
    private static Injected<IConfiguration> _configuration;
    private readonly RequestDelegate _next;

    public CdnMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    private void ContentRoute_CreatedVirtualPath(object sender, UrlResolverEventArgs e)
    {
        var baseUrl = "/";
        if (e.Context.ContextMode != ContextMode.Default ||
            !_mediaPaths.Any(p => e.Context.Url.Path.Trim('/').StartsWith(p))) return;
        if (e.Context.RouteValues == null || !e.Context.RouteValues.Any() ||
            e.Context.RouteValues[RoutingConstants.ContentLinkKey] == null) return;
        var contentLink = e.Context.RouteValues[RoutingConstants.ContentLinkKey] as ContentReference;

        IContent content;
        if (Loader.Service.TryGet(contentLink, out content) && ((ISecurable)content).GetSecurityDescriptor()
            .HasAccess(new ClaimsPrincipal(new ClaimsIdentity()), AccessLevel.Read))
            e.Context.Url = baseUrl + CdnPrefix + Unique(content) + "/" + e.Context.Url.Path;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (CdnEnabled)
        {
            ContentRouteEvents.Service.ResolvedUrl += ContentRoute_CreatedVirtualPath;
        }
        // Call the next delegate/middleware in the pipeline
        await _next(context);

    }

    public static string Unique(IContent content)
    {
        var d = ((IChangeTrackable)content).Saved;
        var hash = 17;
        unchecked
        {
            hash = hash * 23 + d.Month;
            hash = hash * 23 + d.Day;
            hash = hash * 23 + d.Minute;
            hash = hash * 23 + d.Second;
        }

        return hash.ToString("x6");
    }
}
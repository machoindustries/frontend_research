using System.Collections.Generic;
using System.Linq;
using ANA.Shared.Extensions;
using ANA.Site.Business.Interfaces;
using ANA.Site.Business.Services;
using ANA.Site.Business.State;
using ANA.Site.Models;
using ANA.Site.Models.Blocks;
using ANA.Site.Models.CDC.Pages;
using ANA.Site.Models.Pages;
using ANA.Site.Models.ViewModels;
using ANA.Site.Settings;
using EPiServer;
using EPiServer.Commerce.Catalog.ContentTypes;
using EPiServer.Commerce.Order;
using EPiServer.Core;
using EPiServer.DataAbstraction;
using EPiServer.Find.Cms;
using EPiServer.ServiceLocation;
using EPiServer.Shell;
using EPiServer.Web;
using EPiServer.Web.Routing;
using Geta.Optimizely.Extensions;

namespace ANA.Site.Business
{
    [ServiceConfiguration]
    public class PageViewContextFactory
    {
        private readonly IAppSettings _appSettings;
        private readonly IContentLoader _contentLoader;
        private readonly UrlResolver _urlResolver;
        private readonly IFrameRepository _frameRepository;
        private readonly ICartService _cartService;

        public PageViewContextFactory(IAppSettings appSettings, IContentLoader contentLoader, UrlResolver urlResolver, IFrameRepository frameRepository, ICartService cartService)
        {
            _appSettings = appSettings;
            _contentLoader = contentLoader;
            _urlResolver = urlResolver;
            _frameRepository = frameRepository;
            _cartService = cartService;
        }

        public virtual LayoutModel CreateLayoutModel(ContentReference currentContentLink)
        {
            var startPageContentLink = SiteDefinition.Current.StartPage;
            var startPage = _contentLoader.Get<StartPage>(startPageContentLink);
            var settingsPage = startPage.SettingsPage.GetPage<SettingsPage>();

            var currentContent = currentContentLink.GetContent();
            if (!(currentContent is INoIndex))
            {
                UserState.Tracking.LastProductPageUri = currentContentLink.GetUri();
            }

            var breadcrumbItems = new List<MenuItem>();
            var currentPage = currentContent as ICommonProperties;

            var showBreadcrumb = false;

            var logo = new LogoInfo
            {
                ImageUrl = "/assets/img/logos/ana.svg",
                Alt = "American Nurses Association",
                Link = startPage.GetFriendlyUrl() + "ana/"
            };

            if (currentPage != null)
            {
                showBreadcrumb = currentPage.ShowBreadcrumb;
            
                if (showBreadcrumb)
                {
                    // Create Breadcrumbs
                    var currentItem = currentPage;
    
                    while (currentItem != null && !ContentReference.IsNullOrEmpty(currentItem.ParentLink) && !currentItem.ParentLink.Equals(SiteDefinition.Current.RootPage) && !currentItem.ParentLink.Equals(SiteDefinition.Current.WasteBasket))
                    {
                        if (currentItem.HasTemplate())
                        {
                            breadcrumbItems.Insert(0, new MenuItem
                            {
                                contentRef = currentItem.ContentLink,
                                LinkText = currentItem.Name,
                                LinkUrl = _urlResolver.GetUrl(currentItem),
                                IsCurrentPage = currentContent.ContentLink.CompareToIgnoreWorkID(currentItem.ContentLink),
                                IsHomePage = currentItem is StartPage
                            });
                        }

                        currentItem = currentItem.ParentLink.Get<IContent>() as ICommonProperties;
                    }
    
                    if (currentItem is StartPage)
                    {
                        breadcrumbItems.Insert(0, new MenuItem
                        {
                            contentRef = currentItem.ContentLink,
                            LinkText = currentItem.Name,
                            LinkUrl = _urlResolver.GetUrl(currentItem),
                            IsCurrentPage = currentContent.ContentLink.CompareToIgnoreWorkID(currentItem.ContentLink),
                            IsHomePage = true
                        });
                    }

                    if (currentPage is CatalogContentBase)
                    {
                        breadcrumbItems.Insert(0, new MenuItem
                        {
                            contentRef = startPage.ContentLink,
                            LinkText = startPage.Name,
                            LinkUrl = _urlResolver.GetUrl(startPage),
                            IsCurrentPage = false,
                            IsHomePage = true
                        });
                    }
    
                    var i = 1;
    
                    foreach (var item in breadcrumbItems)
                    {
                        item.Index = i;
                        i++;
                    }                    
                }

                ContentReference logoRef;

                if (ContentReference.TryParse(currentPage.LogoId.ToString(), out logoRef))
                {
                    LogoBlock logoBlock;

                    if (_contentLoader.TryGet(logoRef, out logoBlock))
                    {
                        logo.Alt = logoBlock.LogoAlt;
                        logo.ImageUrl = logoBlock.Logo.GetFriendlyUrl();
                        logo.Link = logoBlock.LogoLink.GetFriendlyUrl();
                    }
                }
            }

            var ctaText = string.Empty;
            Url ctaUrl = null;
            var ctaTarget = string.Empty;

            if (settingsPage.CTAButton?.FilteredItems != null && settingsPage.CTAButton.FilteredItems.Any())
            {
                var button = settingsPage.CTAButton.FilteredItems.First().LoadContent() as ButtonBlock;
                
                if (button != null)
                {
                    ctaText = button.Text;
                    ctaUrl = button.ButtonUrl;
                    
                    if (button.TargetFrameRaw != null)
                    {
                        ctaTarget = button.TargetFrame == null
                            ? string.Empty
                            : _frameRepository.Load(button.TargetFrameRaw.Value).Name;
                    }
                }
            }
            
            var addThisKey = string.Empty;
           
            if (currentPage != null && !currentPage.HideSocialSharing)
            {
                addThisKey = settingsPage.AddThisKey;
            }

            bool.TryParse(_appSettings.DisplayGridOverlay, out bool displayGridOverlay);

            var lineItems = _cartService.LoadOrCreateCart(_cartService.DefaultCartName).GetAllLineItems().ToList();

            return new LayoutModel
            {
                StartPage = startPage,
                SettingsPage = settingsPage,
                AssetPathPrefix = _appSettings.AssetPathPrefix,
                Copyright = settingsPage.CopyrightText,
                GlobalBodyScripts = settingsPage.GlobalBodyScripts,
                GlobalFooterScripts = settingsPage.GlobalFooterScripts,
                GlobalHeadScripts = settingsPage.GlobalHeadScripts,
                SiteName = settingsPage.SiteName,
                FacebookAppId = settingsPage.FacebookAppId,
                DefaultSocialImage = settingsPage.DefaultSocialImage ?? ContentReference.EmptyReference,
                SocialLandingUrl = settingsPage.SocialLandingUrl,
                FacebookUrl = settingsPage.FacebookUrl,
                AddThisKey = addThisKey == "" ? "" : addThisKey,
                FooterNavigation = settingsPage.FooterNavigation ?? new ContentArea(),
                LinkedInUrl = settingsPage.LinkedInUrl,
                PrimaryNavigation = settingsPage.PrimaryNavigation ?? new ContentArea(),
                TwitterSite = settingsPage.TwitterSite,
                TwitterUrl = settingsPage.TwitterUrl,
                YouTubeUrl = settingsPage.YouTubeUrl,
                FooterUtilityNavigation = settingsPage.FooterUtilityNavigation,
                BusinessNavigation = settingsPage.BusinessNavigation,
                CommunitySite = settingsPage.CommunitySite,
                CommunitySiteUrl = settingsPage.CommunitySiteUrl,
                CartItemCount = (int)lineItems.Where(i => i.IsVisibleInSummaryViews() && !i.IsMembership()).Sum(i => i.Quantity) + (lineItems.Any(i => i.IsMembership()) ? 1 : 0),
                IsBreadcrumbVisible = showBreadcrumb,
                Breadcrumbs = breadcrumbItems,
                CtaText = ctaText,
                CtaUrl = ctaUrl,
                CtaTarget = ctaTarget,
                Logo = logo,
                DisplayGridOverlay = displayGridOverlay,
                CDCHomePage = settingsPage.CDCHomePage.Get<CDCHomePage>(),
                T2PHomePage = settingsPage.T2PHomePage.Get<CDCHomePage>()
            };
        }
    }
}
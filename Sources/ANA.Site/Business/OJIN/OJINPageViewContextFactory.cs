using ANA.Site.Business.Extensions;
using ANA.Site.Business.Interfaces;
using ANA.Site.Business.Services;
using ANA.Site.Business.State;
using ANA.Site.Models.OJIN.Pages;
using ANA.Site.Models.Pages;
using ANA.Site.Models.ViewModels;
using ANA.Site.Models.ViewModels.Ojin;
using ANA.Site.Settings;
using EPiServer;
using EPiServer.Commerce.Catalog.ContentTypes;
using EPiServer.Core;
using EPiServer.DataAbstraction;
using EPiServer.Find.Cms;
using EPiServer.Web;
using EPiServer.Web.Routing;
using Geta.Optimizely.Extensions;
using System.Collections.Generic;
using ANA.Site.Models;
using System.Linq;
using System;
using ANA.Site.Business.OJIN.OJINInterfaces;
using EPiServer.ServiceLocation;
using System.Text.RegularExpressions;
using ANA.Site.Models.OJIN.Blocks;
using EPiServer.Shell;

namespace ANA.Site.Business.OJIN
{
    [ServiceConfiguration]
    public class OJINPageViewContextFactory
    {
        private readonly IAppSettings _appSettings;
        private readonly IContentLoader _contentLoader;
        private readonly UrlResolver _urlResolver;
        private readonly IFrameRepository _frameRepository;
        private readonly ICartService _cartService;

        public OJINPageViewContextFactory(IAppSettings appSettings, IContentLoader contentLoader, UrlResolver urlResolver, IFrameRepository frameRepository, ICartService cartService)
        {
            _appSettings = appSettings;
            _contentLoader = contentLoader;
            _urlResolver = urlResolver;
            _frameRepository = frameRepository;
            _cartService = cartService;
        }

        public virtual OJINLayoutModel CreateOJINLayoutModel(ContentReference currentContentLink)
        {
            var startPageContentLink = SiteDefinition.Current.StartPage;
            //var startPage = _contentLoader.Get<StartPage>(startPageContentLink);
            var startPage = _contentLoader.Get<OJINHomePage>(startPageContentLink);
            var ojinsitesettingPage = startPage.OJINSiteSettings.GetPage<OJINSiteSettings>();
            var logoURL = ojinsitesettingPage.SiteLogo.Link.GetFriendlyUrl() ?? string.Empty;
            var moblogoURL = ojinsitesettingPage.MobileLogo.Link.GetFriendlyUrl() ?? string.Empty;

            var menu = BuildMainMenu(ojinsitesettingPage.MainNav);

            LogoInfo siteLogoInfo = null;

            LogoInfo mobLogoInfo = null;

            if (ojinsitesettingPage.SiteLogo != null && ojinsitesettingPage.SiteLogo.Image != null)
            {
                siteLogoInfo = new LogoInfo
                {
                    ImageUrl = _urlResolver.GetUrl(ojinsitesettingPage.SiteLogo.Image),
                    Alt = ojinsitesettingPage.SiteLogo.ImageAlt,
                    Link = !string.IsNullOrWhiteSpace(logoURL) ? _urlResolver.GetUrl(logoURL) : string.Empty
                };
            }

            if (ojinsitesettingPage.SiteLogo != null && ojinsitesettingPage.SiteLogo.Image != null)
            {
                mobLogoInfo = new LogoInfo
                {
                    ImageUrl = _urlResolver.GetUrl(ojinsitesettingPage.MobileLogo.Image),
                    Alt = ojinsitesettingPage.MobileLogo.ImageAlt,
                    Link = !string.IsNullOrWhiteSpace(moblogoURL) ? _urlResolver.GetUrl(moblogoURL) : string.Empty
                };

            }

            string notificationMessage = String.Empty;
            if (ojinsitesettingPage.Notification != null && ojinsitesettingPage.Notification.Count > 0)
            {
                foreach (var content in ojinsitesettingPage.Notification.FilteredItems)
                {
                    IContentData contentData = ServiceLocator.Current.GetInstance<IContentLoader>().Get<IContent>(content.ContentLink);
                    if (contentData != null)
                    {
                        if (contentData is OJINAlertBlock)
                        {
                            var notificationBlock = contentData as OJINAlertBlock;
                            notificationMessage = notificationMessage + Regex.Replace(notificationBlock.Content.ToHtmlString(), "<.*?>|&.*?;", string.Empty);
                        }
                    }
                }
            }


            //Breadcrumbs start
            var currentContent = currentContentLink.GetContent();
            if (!(currentContent is INoIndex))
            {
                UserState.Tracking.LastProductPageUri = currentContentLink.GetUri();
            }

            var breadcrumbItems = new List<MenuItem>();
            var currentPage = currentContent as IOJINCommonProperties;

            var showBreadcrumb = false;
            /*
            var logo = new LogoInfo
            {
                ImageUrl = "/assets/img/logos/ana.svg",
                Alt = "American Nurses Association",
                Link = startPage.GetFriendlyUrl() + "ana/"
            };
            */
            if (currentPage != null)
            {
                showBreadcrumb = currentPage.ShowBreadcrumb;

                if (showBreadcrumb)
                {
                    // Create Breadcrumbs
                    var currentItem = currentPage;

                    while (currentItem != null && !ContentReference.IsNullOrEmpty(currentItem.ParentLink) && !currentItem.ParentLink.Equals(SiteDefinition.Current.RootPage) && !currentItem.ParentLink.Equals(SiteDefinition.Current.WasteBasket))
                    {   
                        //getting ShortTitle property from the page concept is not working as it display
                        
                        var pageRefForCurrentItem = new PageReference(currentItem.ContentLink.ID);
                        var currentContentRepository = ServiceLocator.Current.GetInstance<IContentLoader>();
                        var myCurrentPage = currentContentRepository.Get<PageData>(pageRefForCurrentItem);
                        var shortTitle = myCurrentPage.GetPropertyValue("ShortTitle");
                        if (shortTitle == null) shortTitle = currentItem.Name;  

                        if (currentItem.HasTemplate())
                        {
                            breadcrumbItems.Insert(0, new MenuItem
                            {
                                contentRef = currentItem.ContentLink,
                                //LinkText = currentItem.ShortTitle,
                                //LinkText = currentItem.Name,
                                LinkText = shortTitle,
                                LinkUrl = _urlResolver.GetUrl(currentItem),
                                IsCurrentPage = currentContent.ContentLink.CompareToIgnoreWorkID(currentItem.ContentLink),
                                IsHomePage = currentItem is StartPage
                            });
                        }

                        if (currentItem is FolderPage)
                        {
                            breadcrumbItems.Insert(0, new MenuItem
                            {
                                contentRef = currentItem.ContentLink,
                                //LinkText = currentItem.ShortTitle,
                                //LinkText = currentItem.Name,
                                LinkText = shortTitle,
                                LinkUrl = _urlResolver.GetUrl(currentItem),
                                IsCurrentPage = currentContent.ContentLink.CompareToIgnoreWorkID(currentItem.ContentLink),
                                IsHomePage = true
                            });
                        }

                        var pagedepth = currentItem.PageDepth();
                        var parentpageID = currentItem.ParentLink.ID;
                        currentItem = currentItem.ParentLink.Get<IContent>() as IOJINCommonProperties;
                        
                        if (currentItem == null)
                        {
                            var pageRef = new PageReference(parentpageID);
                            var contentRepository = ServiceLocator.Current.GetInstance<IContentLoader>();
                            var page = contentRepository.Get<PageData>(pageRef);
                            if (page.PageTypeName == "FolderPage")
                            {
                                
                                breadcrumbItems.Insert(0, new MenuItem
                                {
                                    
                                    contentRef = page.ContentLink,
                                    LinkText = page.Name,
                                    //LinkText = shortTitle,
                                    LinkUrl = _urlResolver.GetUrl(page),
                                    IsCurrentPage = page.ContentLink.CompareToIgnoreWorkID(page.ContentLink),
                                    IsHomePage = false
                                }) ;

                            }
                            var parentpageID1 = page.ParentLink.ID;
                            currentItem = page.ParentLink.Get<IContent>() as IOJINCommonProperties;
                            if (currentItem == null)
                            {
                                var pageRef1 = new PageReference(parentpageID1);
                                var contentRepository1 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                var page1 = contentRepository1.Get<PageData>(pageRef1);
                                if (page1.PageTypeName == "FolderPage")
                                {
                                    breadcrumbItems.Insert(0, new MenuItem
                                    {
                                        contentRef = page1.ContentLink,
                                        LinkText = page1.Name,
                                        LinkUrl = _urlResolver.GetUrl(page1),
                                        IsCurrentPage = page1.ContentLink.CompareToIgnoreWorkID(page1.ContentLink),
                                        IsHomePage = false
                                    });

                                }
                                var parentpageID2 = page1.ParentLink.ID;
                                currentItem = page1.ParentLink.Get<IContent>() as IOJINCommonProperties;
                                if (currentItem == null)
                                {
                                    var pageRef2 = new PageReference(parentpageID2);
                                    var contentRepository2 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                    var page2 = contentRepository2.Get<PageData>(pageRef2);
                                    if (page2.PageTypeName == "FolderPage")
                                    {
                                        breadcrumbItems.Insert(0, new MenuItem
                                        {
                                            contentRef = page2.ContentLink,
                                            LinkText = page2.Name,
                                            LinkUrl = _urlResolver.GetUrl(page2),
                                            IsCurrentPage = page2.ContentLink.CompareToIgnoreWorkID(page2.ContentLink),
                                            IsHomePage = false
                                        });

                                    }
                                }
                            }
                            //currentItem = currentItem.ParentLink.Get<IContent>() as IOJINCommonProperties;
                        }

                                                                

                    }                    

                    if (currentItem is StartPage || currentItem is OJINHomePage)
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

                    //==Read immediate first page node.
                    foreach (var firstPage in breadcrumbItems)
                    {
                        var i1 = 0;   
                        if (i1 == 0)
                        {
                            var fpage = firstPage.contentRef.ID;
                            var fpageRef = new PageReference(fpage);
                            var contentRepository2 = ServiceLocator.Current.GetInstance<IContentLoader>();
                            var fpage1 = contentRepository2.Get<PageData>(fpageRef);

                            PageDataCollection Pagelist = new PageDataCollection();
                            var ChildListoftoc = fpage1.GetDescendants(1);
                            if (ChildListoftoc != null && ChildListoftoc.Count() > 0)
                            {
                                Pagelist = FindDescendantsOfPage(fpage1, Pagelist);
                                if (Pagelist != null && Pagelist.Count() > 0)
                                {
                                    var iCnt = 0;
                                    foreach (var childPage in Pagelist)
                                    {
                                        if (childPage.PageTypeName == typeof(OJINHomePage).Name.ToString())
                                        {
                                            if (iCnt == 0)
                                            {
                                                var firstpage = childPage.ContentLink.ID;
                                                var fpageRef1 = new PageReference(firstpage);
                                                var fpage2 = contentRepository2.Get<PageData>(fpageRef1);

                                                //assuming here page type would not be folder, expecting listing page here.

                                                breadcrumbItems.RemoveAt(0);
                                                breadcrumbItems.Insert(0, new MenuItem
                                                {
                                                    contentRef = fpage2.ContentLink,
                                                    LinkText = fpage2.Name,
                                                    LinkUrl = _urlResolver.GetUrl(fpage2),
                                                    IsCurrentPage = false, 
                                                    IsHomePage = false
                                                });
                                            }
                                            iCnt++;
                                            break;
                                        }
                                        
                                    }

                                }
                            }
                        }
                        i1++;
                        break;
                    }
                    //==Read immediate first page node.
                }
                /*
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
                } */
            }
            /*
            var ctaText = string.Empty;
            Url ctaUrl = null;
            var ctaTarget = string.Empty;

            if (ojinsitesettingPage.CTAButton?.FilteredItems != null && ojinsitesettingPage.CTAButton.FilteredItems.Any())
            {
                var button = settingsPage.CTAButton.FilteredItems.First().GetContent() as ButtonBlock;

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

            bool displayGridOverlay;

            bool.TryParse(WebConfigurationManager.AppSettings["DisplayGridOverlay"], out displayGridOverlay);

            var lineItems = _cartService.LoadOrCreateCart(_cartService.DefaultCartName).GetAllLineItems().ToList();
            */
            //Breadcrumbs end


            return new OJINLayoutModel
            {
                StartPage = startPage,
                OJINSiteSettingsPage = ojinsitesettingPage,
                AssetPathPrefix = _appSettings.AssetPathPrefix,     //added *_ojinbase
                TwitterUrl = ojinsitesettingPage.TwitterUrl,    //added *_ojinbase
                FacebookUrl = ojinsitesettingPage.FacebookUrl,
                YouTubeUrl = ojinsitesettingPage.YouTubeUrl,
                LinkedInUrl = ojinsitesettingPage.LinkedInUrl,
                Copyright = ojinsitesettingPage.CopyrightText,
                GlobalHeadScripts = ojinsitesettingPage.GlobalHeadScripts,
                GlobalFooterScripts = ojinsitesettingPage.GlobalFooterScripts,
                GlobalBodyScripts = ojinsitesettingPage.GlobalBodyScripts,
                Fevicon = ojinsitesettingPage.Favicon ?? ContentReference.EmptyReference,
                SiteName = ojinsitesettingPage.SiteName,
                SiteLogo = siteLogoInfo,
                MobileLogo = mobLogoInfo,
                SearchPage = ojinsitesettingPage.SearchPage != null ? _urlResolver.GetUrl(ojinsitesettingPage.SearchPage) : string.Empty,
                LoginPage = ojinsitesettingPage.LoginPage ?? string.Empty,
                JoinNow = ojinsitesettingPage.JoinNow ?? new PageReference(),
                MainNav = BuildMainMenu(ojinsitesettingPage.MainNav),
                FooterBottomLinksCol1 = ojinsitesettingPage.FooterBottomLinksCol1,
                FooterBottomLinksCol2 = ojinsitesettingPage.FooterBottomLinksCol2,
                FooterCopyright = ojinsitesettingPage.FooterCopyright,
                FooterContact = ojinsitesettingPage.FooterContact,
                FooterCopyrightLink = ojinsitesettingPage.FooterCopyrightLink != null ? _urlResolver.GetUrl(ojinsitesettingPage.FooterCopyrightLink) : string.Empty,
                FooterPrivacyLink = ojinsitesettingPage.FooterPrivacyLink != null ? _urlResolver.GetUrl(ojinsitesettingPage.FooterPrivacyLink) : string.Empty,
                FooterPrivacyLabel = ojinsitesettingPage.FooterPrivacyLabel,
                FooterPrivacyChoicesLink = ojinsitesettingPage.FooterPrivacyChoicesLink,
                IsBreadcrumbVisible = showBreadcrumb,
                Breadcrumbs = breadcrumbItems,
                OJINAddThisScript = ojinsitesettingPage.OJINAddThisScript,
                NotificationMessage = notificationMessage,
                TableOfContentPageID = ojinsitesettingPage.TableOfContentPageID != null ? ojinsitesettingPage.TableOfContentPageID.ID : 0,
                FolderIDToSearchLetters = ojinsitesettingPage.FolderIDToSearchLetters != null ? ojinsitesettingPage.FolderIDToSearchLetters.ID : 0,
                LettersToTheEditorPageID = ojinsitesettingPage.LettersToTheEditorPageID != null ? ojinsitesettingPage.LettersToTheEditorPageID.ID : 0,
                ColumnsPageID = ojinsitesettingPage.ColumnsPageID != null ? ojinsitesettingPage.ColumnsPageID.ID : 0,
                TopicsPageID = ojinsitesettingPage.TopicsPageID != null ? ojinsitesettingPage.TopicsPageID.ID : 0
            };
        }

        private List<OJINPageMenuItem> BuildMainMenu(IList<ContentReference> contentRefs)
        {
            if (contentRefs == null && contentRefs.Count == 0)
                return null;

            try
            {
                List<OJINPageMenuItem> items = new List<OJINPageMenuItem>();

                foreach (ContentReference contentRef in contentRefs)
                {
                    var menuItem = _contentLoader.Get<PageData>(contentRef);

                    if (menuItem == null || !menuItem.VisibleInMenu) continue;

                    string title = menuItem.Name;

                    OJINBaseListingPage menuOJINItem;

                    var isMenuOJINItem = _contentLoader.TryGet<OJINBaseListingPage>(menuItem.ContentLink, out menuOJINItem);

                    if(menuOJINItem != null && !string.IsNullOrWhiteSpace(menuOJINItem.ShortTitle))
                    {
                        title = menuOJINItem.ShortTitle;
                    }
                    else if(menuOJINItem != null && !string.IsNullOrWhiteSpace(menuOJINItem.Title))
                    {
                        title = menuOJINItem.Title;
                    }

                    OJINPageMenuItem item = new OJINPageMenuItem
                    {
                        Text = title,
                        Href = menuItem.LinkURL
                    };

                    // add level 2 menu items
                    IEnumerable<PageData> subMenu;
                    try
                    {
                        subMenu = _contentLoader.GetChildren<PageData>(contentRef);
                    }
                    catch
                    {
                        subMenu = null;
                    }

                    if (subMenu != null)
                    {
                        item.SubItems = BuildOJINPageSubMenu(subMenu);
                    }

                    items.Add(item);
                }

                return items;
            }
            catch
            {
            }

            return null;
        }

        private List<OJINPageMenuItem> BuildOJINPageSubMenu(IEnumerable<PageData> contentRefs)
        {
            if (contentRefs == null && contentRefs?.Count() == 0)
                return null;

            List<OJINPageMenuItem> items = new List<OJINPageMenuItem>();
            foreach (PageData contentRef in contentRefs)
            {
                if (contentRef == null || !contentRef.VisibleInMenu) continue;

                OJINPageMenuItem item;

                string _href = "";
                string title = contentRef.Name;
                if (contentRef is FolderPage)
                {
                    _href = "";
                }
                else
                {
                    _href = _urlResolver.GetUrl(contentRef.ContentLink);

                    OJINBaseListingPage menuOJINItem;

                    var isMenuOJINItem = _contentLoader.TryGet<OJINBaseListingPage>(contentRef.ContentLink, out menuOJINItem);

                    if (menuOJINItem != null && !string.IsNullOrWhiteSpace(menuOJINItem.ShortTitle))
                    {
                        title = menuOJINItem.ShortTitle;
                    }
                    else if(menuOJINItem != null && !string.IsNullOrWhiteSpace(menuOJINItem.Title))
                    {
                        title = menuOJINItem.Title;
                    }
                }


                item = new OJINPageMenuItem
                {
                    Text = title,
                    Href = _href,
                };

                // add level 3 menu items
                IEnumerable<PageData> l3Menu;
                try
                {
                    l3Menu = _contentLoader.GetChildren<PageData>(contentRef.ContentLink);
                }
                catch
                {
                    l3Menu = null;
                }

                if (l3Menu != null && l3Menu.Count() > 0)
                {
                    item.SubItems = BuildOJINPageSubMenu(l3Menu);
                }

                items.Add(item);

            }
            return items;
        }


        private void BuildContentArea(ContentArea contentArea)
        {

            foreach(var item in contentArea.FilteredItems)
            {
                var test = _urlResolver.GetUrl(item.ContentLink);
            }
        }

        public static string getShortTitleOfThePage(PageData pageData)
        {
            var getShortTitleOfThePage = "";

            //var childrenType = pageData.GetDescendants(1);
            //foreach (var child in childrenType)
            //{
            //    if (pageData.PageTypeName != child.PageTypeName)
            //    {
            //        childrenTypeDifferent = true;
            //    }
            //}
            return getShortTitleOfThePage;
        }

        public static PageDataCollection FindDescendantsOfPage(PageData pageData, PageDataCollection descendants)
        {
            var childItems = pageData.GetDescendants(1);
            foreach (var child in childItems)
            {
                if (child != null)
                {
                    descendants.Add(child);
                }
                FindDescendantsOfPage(child, descendants);
            }
            return descendants;
        }
    }
}
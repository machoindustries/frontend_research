using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ANA.Site.Business.Helpers;
using ANA.Site.Business.Repositories;
using ANA.Site.Business.Services.Implementations;
using ANA.Site.Business.State;
using ANA.Site.Models.Blocks;
using ANA.Site.Models.CustomerAccountModels;
using ANA.Site.Models.ViewModels;
using EPiServer.Framework.DataAnnotations;
using EPiServer.Framework.Web;
using EPiServer.Web.Mvc;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using System;
using ANA.Site.Models.ANAEnterpriseAPIModels;
using Geta.Optimizely.Extensions;
using EPiServer.Logging;
using ANA.Site.Business.Services;

namespace ANA.Site.Controllers.Blocks
{
    [TemplateDescriptor(Inherited = true, TemplateTypeCategory = TemplateTypeCategories.MvcPartialComponent)]
    public class AccountMyMembershipBlockComponent : AsyncBlockComponent<AccountMyMembershipBlock>
    {
        private readonly IPurchasingGroupService _purchasingGroupService;
        private readonly ICustomerAccountRepository _customerAccountRepository;
        private static ILogger Logger { get; } = LogManager.GetLogger();

        private readonly IDBLogManager _logManager;
        public AccountMyMembershipBlockComponent(IPurchasingGroupService purchasingGroupService, ICustomerAccountRepository customerAccountRepository, IDBLogManager logManager)
        {
            _purchasingGroupService = purchasingGroupService;
            _customerAccountRepository = customerAccountRepository;
            _logManager = logManager;
        }

        protected async override Task<IViewComponentResult> InvokeComponentAsync(AccountMyMembershipBlock currentBlock)
        {
            var model = new AccountMyMembershipViewModel
            {
                Heading = currentBlock.Heading,
                Description = currentBlock.Description,
                NoResultsMessage = currentBlock.NoResultsMessage,
                LightboxMembership = new MembershipLightboxViewModel(),
                UpgradeMembershipBlock = currentBlock.UpgradeMembershipBlock
            };
            var settings = SettingsHelper.GetSettings();
            model.CompareMembershipBenefitsImageUrl = settings?.CompareMembershipBenefitsImage != null ? settings.CompareMembershipBenefitsImage.GetFriendlyUrl() : "/assets/img/compare_membership_benefits.jpg";

            model.DisplayUpgradeMemberShipBlock = await IsPremierMembershipAccessible();

            model.LightboxMembership.MembershipTypes = await GetPurchasingGroups();
            model.LightboxMembership.CancelReasons = await GetCancelReasons();

            ViewData.GetEditHints<AccountMyMembershipViewModel, AccountMyMembershipBlock>()
                .AddConnection(x => x.Heading, x => x.Heading)
                .AddConnection(x => x.Description, x => x.Description)
                .AddConnection(x => x.NoResultsMessage, x => x.NoResultsMessage);

            return await Task.FromResult(View(model));
        }


        private async Task<bool> IsPremierMembershipAccessible()
        {
            try
            {
                UserProfile userProfile = UserState.CurrentProfile;

                bool isUpgradeToPremierBlockDisplay = false;
                var premierRole = SettingsHelper.GetSettings().OldPremierMembershipRole != null ? SettingsHelper.GetSettings().OldPremierMembershipRole : "Premier_Membership_Role";
                var ANAAndStateOnlyRateCode = SettingsHelper.GetSettings().ANAAndStateOnlyRateCode != null ? SettingsHelper.GetSettings().ANAAndStateOnlyRateCode : "FULL";
                var memberships = await _customerAccountRepository.GetMemberships(userProfile.CustomerId);  
                if (memberships != null)
                {
                    var membershipModelANA = memberships.Membership
                        .FirstOrDefault(t => t.Association.Equals(Global.MembershipTypes.ANA.ToString()));
                    if (membershipModelANA != null)
                    {
                        var order = await _customerAccountRepository.GetOrder(membershipModelANA.OrderNumber);
                        if (order.LineItems.LineItem.Any())
                        {
                            var ratecode = order.LineItems.LineItem.First().RateCode ?? string.Empty;
                            var productCode = order.LineItems.LineItem.First().Sku.ToString();
                            if (ratecode.Contains(ANAAndStateOnlyRateCode) && productCode == SettingsHelper.GetSettings().ANAAndStateOnlyMembershipCode?.ToString())
                            {
                                isUpgradeToPremierBlockDisplay = ratecode.Contains("-M");                          
                            }

                        }
                    }
                }
                if(isUpgradeToPremierBlockDisplay)
                {
                 var role = userProfile.IMSRoles?.IMSRole != null
                 ? (from custRole in userProfile.IMSRoles.IMSRole
                    where custRole.RoleId.Contains(premierRole)
                    select custRole.RoleId)
                   .FirstOrDefault()
                 : null;
                    // Get the first matching role as a string

                    if (!string.IsNullOrEmpty(role)) // Properly check if role is not null or empty
                    {
                        isUpgradeToPremierBlockDisplay = false;
                    }
                }

                List<StateModel> vppStates = Task.Run(() => _customerAccountRepository.GetVPPStates()).GetAwaiter().GetResult();
                DateTime? pmrdValidTillDate = Task.Run(() => _customerAccountRepository.GetPMRDValidTillDate()).GetAwaiter().GetResult();
                if(pmrdValidTillDate == null)
                {
                    pmrdValidTillDate = DateTime.MaxValue;
                }

                if (vppStates?.Count > 0 && userProfile.MemberType != null)
                {
                    return DateTime.Today.Date < pmrdValidTillDate && vppStates.Exists(x => x.Code == GeographyHelper.GetStateCode(userProfile.State) && isUpgradeToPremierBlockDisplay);
                }

                return false;
            }
            catch (Exception ex)
            {
                _logManager.LogExceptionAsync(ex, "My Account", "Premier Membership", ex.Message, ex.InnerException?.Message, ex.ToString());
                return false;
            }
        }


       private async Task<IEnumerable<SelectListItem>> GetPurchasingGroups()
        {
            var result = await _purchasingGroupService.GetPurchasingGroups();
            
            var list = new List<SelectListItem>();

            if (result.Groups == null || !result.Groups.Any()) return list;

            list.Add(new SelectListItem
            {
                Text = "Select Association...",
                Value = string.Empty
            });
            
            list.AddRange(result.Groups.Select(group => new SelectListItem
            {
                Text = group.Description,
                Value = group.Association
            }));

            return list;
        }

        private async Task<IEnumerable<SelectListItem>> GetCancelReasons()
        {
            var result = await _purchasingGroupService.GetPurchasingGroups();

            var list = new List<SelectListItem>();

            if (result.Groups == null || !result.Groups.Any()) return list;

            list.Add(new SelectListItem { Text = "Cannot afford the membership dues", Value = "13" });
            list.Add(new SelectListItem { Text = "Dissatisfied with ANA", Value = "05" });
            list.Add(new SelectListItem { Text = "Membership benefits are not worth the price", Value = "50" });
            list.Add(new SelectListItem { Text = "Dissatisfied with my State Association", Value = "04" });
            list.Add(new SelectListItem { Text = "Other", Value = "15" });
            

            return list;
        }

        
    }
}
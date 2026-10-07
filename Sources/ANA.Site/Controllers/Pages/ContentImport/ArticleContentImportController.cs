using ANA.Site.Models.OJIN.Blocks;
using ANA.Site.Models.OJIN.Pages;
using ANA.Site.Models.Pages;
using ANA.Site.Models.Pages.OJIN;
using ClosedXML.Excel;
using EPiServer;
using EPiServer.Core;
using EPiServer.DataAbstraction;
using EPiServer.DataAccess;
using EPiServer.Security;
using EPiServer.ServiceLocation;
using Geta.Optimizely.Extensions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;



/// <summary>
/// 09-May-2022: Implemented Articles in Previously Published Topics functionality.
/// 11-MAY-2022: Commented validation to read ParentID from web config file as we are given a provision in the Front End.
/// </summary>
namespace ANA.Site.Controllers.Pages.ContentImport
{
    public class ArticleContentImportController : Controller
    {
        private readonly IWebHostEnvironment _webHostEnvironment;

        public ArticleContentImportController(IWebHostEnvironment webHostEnvironment)
        {
            _webHostEnvironment = webHostEnvironment;
        }

        public IActionResult Index()
        {
            //if (User.Identity.IsAuthenticated &&
            //    EPiServer.Security.PrincipalInfo.HasAdminAccess)
            //if(CurrentPage.ACL.QueryDistinctAccess(EPiServer.Security.AccessLevel.Create))
            //{

            var pageRouteHelper =
                EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance
                <EPiServer.Web.Routing.IPageRouteHelper>();

            PageData currentPage = pageRouteHelper.Page;

            return View(currentPage);

            //}
            //else
            //    return null;

        }

        public static DataTable ConvertCSVtoDataTable(string strFilePath)
        {
            DataTable dt = new DataTable();
            using (StreamReader sr = new StreamReader(strFilePath))
            {
                string[] headers = sr.ReadLine().Split(',');
                foreach (string header in headers)
                {
                    dt.Columns.Add(header);
                }

                while (!sr.EndOfStream)
                {
                    string[] rows = sr.ReadLine().Split(',');
                    if (rows.Length > 1)
                    {
                        DataRow dr = dt.NewRow();
                        for (int i = 0; i < headers.Length; i++)
                        {
                            dr[i] = rows[i].Trim();
                        }
                        dt.Rows.Add(dr);
                    }
                }

            }


            return dt;
        }

        public static DataTable ConvertXSLXtoDataTable(string strFilePath)
        {
            DataTable dt = new DataTable();
            try
            {
                using (var workbook = new XLWorkbook(strFilePath))
                {
                    var worksheet = workbook.Worksheet("GMContentReport");
                    bool firstRow = true;
                    foreach (var row in worksheet.Rows())
                    {
                        if (firstRow)
                        {
                            foreach (var cell in row.Cells())
                            {
                                dt.Columns.Add(cell.Value.ToString());
                            }
                            firstRow = false;
                        }
                        else
                        {
                            dt.Rows.Add();
                            int i = 0;
                            foreach (var cell in row.Cells())
                            {
                                dt.Rows[dt.Rows.Count - 1][i] = cell.Value.ToString();
                                i++;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                var msg = ex.Message;
            }

            return dt;
        }

        private string GetUploadsPath(string fileName)
        {
            var path1UploadsDirectory = Path.Combine(_webHostEnvironment.ContentRootPath, "Content", "Uploads");
            if (!Directory.Exists(path1UploadsDirectory))
                Directory.CreateDirectory(path1UploadsDirectory);

            string path = Path.Combine(path1UploadsDirectory, fileName);

            return path;
        }

        [ActionName("Importexcel")]
        [HttpPost]
        public IActionResult Importexcel()
        {
            ViewBag.Error = string.Empty;

            var fileUpload1 = Request.Form.Files["FileUpload1"];

            if (fileUpload1.Length > 0)
            {
                string extension = Path.GetExtension(fileUpload1.FileName).ToLower();

                string[] validFileTypes = { ".xls", ".xlsx", ".csv" };

                var path1 = GetUploadsPath(fileUpload1.FileName);
                if (validFileTypes.Contains(extension))
                {
                    if (System.IO.File.Exists(path1))
                        System.IO.File.Delete(path1);

                    using (var stream = new FileStream(path1, FileMode.Create))
                    {
                        fileUpload1.CopyTo(stream);
                    }

                    DataTable dt = null;

                    if (extension == ".csv")
                    {
                        dt = ConvertCSVtoDataTable(path1);
                        ViewBag.Data = dt;
                    }
                    else if (extension.Trim() == ".xls")
                    {
                        dt = ConvertXSLXtoDataTable(path1);
                        ViewBag.Data = dt;
                    }
                    else if (extension.Trim() == ".xlsx")
                    {
                        dt = ConvertXSLXtoDataTable(path1);
                        ViewBag.Data = dt;
                    }

                    if (dt != null)
                    {
                        var parentFolderId = 27633;
                        var parentPage = new ContentReference(parentFolderId);

                        if (parentPage == null) 
                        {
                            return null;
                        }

                        var i = 0;
                        var j = 0;
                        foreach (DataRow row in dt.Rows)
                        {
                            try
                            {
                                IContentRepository contentRepository =
                                    EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
                                var newPage = contentRepository.GetDefault<OjinArticlePage>(parentPage);

                                var introText = row["Content Html"].ToString();

                                var listOfImgdata = FetchImgsFromSource(introText);

                                var newPath = "/assets/img/OJINImages/";

                                if (listOfImgdata?.Count > 0)
                                {
                                    foreach (var item in listOfImgdata)
                                    {
                                        var fileName = Path.GetFileName(item);
                                        var imgSrc = newPath + fileName;
                                        introText = Regex.Replace(introText, "<img.+?src=[\"'](.+?)[\"'].*?>", @"<img src='" + imgSrc + @"'/>");
                                    }
                                }

                                newPage.Name = row["Content Title"].ToString();
                                newPage.Created = DateTime.Parse(row["Publication Date"].ToString());
                                newPage.Changed = DateTime.Parse(row["Publication Date"].ToString());
                                newPage.PublicationDate = DateTime.Parse(row["Publication Date"].ToString());
                                newPage.LegacyId = Int32.Parse(row["Content Item Id"].ToString());
                                newPage.DocumentType = row["Document Type"].ToString();
                                newPage.Authors = row["Authors"].ToString();
                                newPage.IntroText = new XhtmlString(introText);
                                //newPage.SortIndex = index * 10;
                                newPage.ChildSortOrder = EPiServer.Filters.FilterSortOrder.Alphabetical;
                                newPage.ExternalURL = null;
                                newPage.VisibleInMenu = false;
                                newPage.MetaTitle = WebUtility.HtmlDecode(row["Content Title"].ToString());
                                newPage.ExternalURL =
                                    parentFolderId.ToString() +
                                    "-" +
                                    Guid.NewGuid() +
                                    "-" +
                                    row["Content Alias"].ToString();

                                contentRepository.Save(newPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
                                i++;
                            }

                            catch (Exception ex)
                            {
                                var msg = ex.Message;
                                j++;
                            }
                        }
                        ViewBag.Error = "Number of items imported successfully: " + i
                                        + "<br /><br />"
                                        + "Number of items failed to import: " + j;
                    }
                    else
                    {
                        ViewBag.Error = "Data table is null";
                    }
                }
                else
                {
                    ViewBag.Error = "Please Upload Files in .xls, .xlsx or .csv format";
                }
            }

            else
            {
                ViewBag.Error = "No file found";
            }


            return View();
        }

        public static List<string> FetchImgsFromSource(string htmlSource)
        {
            List<string> listOfImgdata = new List<string>();
            string regexImgSrc = @"<img[^>]*?src\s*=\s*[""']?([^'"" >]+?)[ '""][^>]*?>";
            MatchCollection matchesImgSrc = Regex.Matches(htmlSource, regexImgSrc, RegexOptions.IgnoreCase | RegexOptions.Singleline);
            foreach (Match m in matchesImgSrc)
            {
                string href = m.Groups[1].Value;
                listOfImgdata.Add(href);
            }
            return listOfImgdata;
        }

        [ActionName("ImportJSONCDData")]
        [HttpPost]
        public IActionResult ImportJSONCDData()
        {  

            ViewBag.Error = string.Empty;

            /*if (parentID != null && parentID.Length > 0)
            {*/
                var fileUpload1 = Request.Form.Files["FileUpload1"];
                if (fileUpload1.Length > 0)
                {
                    string extension = Path.GetExtension(fileUpload1.FileName).ToLower();

                    string[] validFileTypes = { ".json" };

                    //added validation to log failed records.
                    var logContentID = "";
                    var logContentTitle = "";
                    var logContentAlias = "";


                    
                    var path1 = GetUploadsPath(fileUpload1.FileName);

                    if (validFileTypes.Contains(extension))
                    {
                        if (System.IO.File.Exists(path1))
                            System.IO.File.Delete(path1);

                        using (var stream = new FileStream(path1, FileMode.Create))
                        {
                            fileUpload1.CopyTo(stream);
                        }

                        Logger("Create a log file", path1);

                        if (extension == ".json")
                        {
                            using (StreamReader readJSON = new StreamReader(path1))
                            {
                                string json = readJSON.ReadToEnd();
                                json = RemoveInvalidCharacter(json);
                                dynamic JSONarray = JsonConvert.DeserializeObject(json);                                

                                var parentFolderId = Request.Form["ParentFolderIDFromText"];  //parentID;   //Eerlier reading from webconfig file.

                                var parentPage = new ContentReference(parentFolderId);

                                if (parentPage == null)
                                {
                                    return null;
                                }

                                var parentBlockID = Request.Form["ParentFolderIDFromTextForABlock"];
                                if (string.IsNullOrEmpty(parentBlockID))
                                {
                                    return null;
                                }

                                var i = 0;
                                var j = 0;                                

                                foreach (var jsonRecord in JSONarray)
                                {
                                    try
                                    {
                                        if (jsonRecord["VolumeDescription"].ToString() == "" || jsonRecord["NumberDescription"].ToString() == "" || jsonRecord["ShortTitle"].ToString() == "")
                                        {
                                            var contentId = jsonRecord["ContentId"].ToString(); //ShortTitle
                                            Logger("Details of " + contentId + " missing in JSON File", path1);
                                            continue;
                                        }

                                        logContentID = jsonRecord["ContentId"].ToString();
                                        logContentTitle = jsonRecord["ContentTitle"].ToString();
                                        logContentAlias = jsonRecord["ContentAlias"].ToString();

                                        var volDescription = jsonRecord["VolumeDescription"].ToString();
                                        var numDescription = jsonRecord["NumberDescription"].ToString();
                                        var shortTitle = jsonRecord["ShortTitle"].ToString();
                                        var contentTitle = jsonRecord["ContentTitle"].ToString();
                                        var appendAuthorNameData = jsonRecord["Year"].ToString() + "-" + jsonRecord["Month"].ToString() + "-" + jsonRecord["Volume"].ToString() + "-" + jsonRecord["Number"].ToString();
                                        
                                        var volumeFolderCRID = new ContentReference();
                                        var numberNodeCRID = new ContentReference();
                                        var cdPageID = new ContentReference();
                                        var volumeFolderID = "";
                                        var numberNodeID = "";
                                        var cdpageid = "";

                                        //==
                                        var aipptDescription = jsonRecord["VolumeDescription"].ToString();
                                        aipptDescription = "";  //purposely, running into exception, revisit later.
                                        aipptDescription = "Articles on Previously Published Topics";
                                        var aipptFolderCRID = new ContentReference();
                                        var aipptFolderID = "";
                                        var aipptTextExistInCAlias = 0;
                                        aipptTextExistInCAlias = aipptTextExistInCAlias_New(jsonRecord["ContentAlias"].ToString());                                                                              
                                        //if found then create the folder under number container 
                                        //also, get its ID in one variable and create article page under that.
                                        //==

                                        //=== This logic implemented on 28-APR-2022 after Check-In call with Frank.
                                        var volName = GetVolumeContainerName(volDescription);
                                        var numName = GetNumberContainerName(numDescription);
                                        //===

                                        //== This section is to create Author block logic, 28-APR-2022EOD
                                        var volumeFolderCRIDForAuthor = new ContentReference();
                                        var volumeFolderForAuthorID = "";
                                        var numberFolderCRIDForAuthor = new ContentReference();
                                        var numberFolderForAuthorID = "";
                                        //ContentReference blockVolumeFolder = null;
                                        //==

                                        //===
                                        //var parentBlockID = 17104; //= Authors//17088 ="OJIN";
                                        var parentBlockFolderID = new ContentReference(parentBlockID);
                                        var parentBlockFolderPage = new PageReference(parentBlockFolderID);
                                        var crForBlockAuthorFolder = ServiceLocator.Current.GetInstance<IContentLoader>();
                                        var fvOfAuthorFolder = crForBlockAuthorFolder.Get<ContentFolder>(parentBlockFolderPage);

                                        var authorAvailable = jsonRecord["AuthorModels"].ToString();
                                        if (authorAvailable != "")
                                        {

                                            IEnumerable<IContent> blockVolumeFolders = crForBlockAuthorFolder.GetChildren<IContent>(parentBlockFolderPage);
                                            foreach (var v in blockVolumeFolders)
                                            {
                                                if (v.Name == volName)
                                                {
                                                    volumeFolderForAuthorID = v.ContentLink.ID.ToString();
                                                    volumeFolderCRIDForAuthor = new ContentReference(volumeFolderForAuthorID);
                                                    break;
                                                }
                                            }

                                            if (volumeFolderForAuthorID != null && volumeFolderForAuthorID.Length > 0)
                                            {
                                                var parentBlockVolumeFolderPage = new PageReference(volumeFolderForAuthorID);
                                                IEnumerable<IContent> blockNumberFolders = crForBlockAuthorFolder.GetChildren<IContent>(parentBlockVolumeFolderPage);
                                                foreach (var n in blockNumberFolders)
                                                {
                                                    if (n.Name == numName)
                                                    {
                                                        numberFolderForAuthorID = n.ContentLink.ID.ToString();
                                                        numberFolderCRIDForAuthor = new ContentReference(numberFolderForAuthorID);
                                                        break;
                                                    }
                                                }
                                                if (numberFolderForAuthorID != null && numberFolderForAuthorID.Length > 0)
                                                {
                                                    //no action item needd at this point of time. I got Number Container Folder ID.
                                                }
                                                else
                                                {
                                                    //create Number Container Folder For Author in case Volume Container is there but Number Container is not there.
                                                    numberFolderCRIDForAuthor = CreateContentFolder(numName, volumeFolderCRIDForAuthor);
                                                    numberFolderForAuthorID = numberFolderCRIDForAuthor.ID.ToString();
                                                }
                                            }
                                            else
                                            {
                                                //create volumefolderforAuthor and underneath create numberfolderforAuthor
                                                volumeFolderCRIDForAuthor = CreateContentFolder(volName, parentBlockFolderPage);
                                                volumeFolderForAuthorID = numberFolderCRIDForAuthor.ID.ToString();

                                                //create Number folder container under 'Volume Folder for Author'
                                                numberFolderCRIDForAuthor = CreateContentFolder(numName, volumeFolderCRIDForAuthor);
                                                numberFolderForAuthorID = numberFolderCRIDForAuthor.ID.ToString();
                                            }
                                        }
                                        //== This section is to create Author block logic ends here

                                        //==
                                        var pageRef2 = new PageReference(parentFolderId);
                                        var contentRepository2 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                        var page2 = contentRepository2.Get<PageData>(pageRef2);

                                        PageDataCollection volumeList = new PageDataCollection();
                                        var aa = page2.GetDescendants(1); 

                                        var ChildList = page2.GetDescendants(1);
                                        if (ChildList != null && ChildList.Count() > 0)
                                        {
                                            volumeList = FindDescendantsOfPage(page2, volumeList);
                                        }

                                        if (volumeList != null && volumeList.Count() > 0)
                                        {
                                            foreach (var checkVolume in volumeList)
                                            {
                                                if (checkVolume.Name == volDescription)
                                                {
                                                    volumeFolderID = checkVolume.ContentLink.ID.ToString();
                                                    volumeFolderCRID = new ContentReference(volumeFolderID);
                                                    //I could check NumberContainer and Page search here as well,
                                                    //however, there is possibility that the same number container and underneath page would be same in another Volume container,
                                                    //so following the standard search. --In case this is not true then have some flags to deal with this code.
                                                    //volumeFolderCRID = ((EPiServer.Core.ContentReference)volumeFolderID).ID;
                                                    break;
                                                }
                                            }
                                        }

                                        if (volumeFolderID != null && volumeFolderID.Length > 0)
                                        {
                                            var pageRef3 = new PageReference(volumeFolderID);
                                            var contentRepository3 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                            var page3 = contentRepository2.Get<PageData>(pageRef3);
                                            PageDataCollection numberList = new PageDataCollection();

                                            var ChildList2 = page3.GetDescendants(1);
                                            if (ChildList2 != null && ChildList2.Count() > 0)
                                            {
                                                numberList = FindDescendantsOfPage(page3, numberList);
                                            }

                                            if (numberList != null && numberList.Count() > 0)
                                            {                                             

                                                foreach (var checkNumber in numberList)
                                                {
                                                    if (checkNumber.Name == numDescription)
                                                    {
                                                        numberNodeID = checkNumber.ContentLink.ID.ToString();
                                                        numberNodeCRID = new ContentReference(numberNodeID);
                                                        break;
                                                    }
                                                }
                                                if (numberNodeID != null && numberNodeID.Length > 0)
                                                {
                                                    var pageRef4 = new PageReference(numberNodeCRID);
                                                    var contentRepository4 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                    var page4 = contentRepository4.Get<PageData>(pageRef4);
                                                    PageDataCollection pageList = new PageDataCollection();

                                                    var ChildList3 = page4.GetDescendants(1);
                                                    if (ChildList3 != null && ChildList3.Count() > 0)
                                                    {
                                                        pageList = FindDescendantsOfPage(page4, pageList);
                                                    }
                                                    if (pageList != null && pageList.Count > 0)
                                                    {
                                                        foreach (var checkpage in pageList)
                                                        {
                                                            if (checkpage.Name == contentTitle)// shortTitle)
                                                            {
                                                                cdpageid = checkpage.ContentLink.ID.ToString();
                                                                cdPageID = new ContentReference(cdpageid);
                                                                break;
                                                            }
                                                            if (aipptTextExistInCAlias == 1)
                                                            {
                                                                if (checkpage.Name == aipptDescription)
                                                                {
                                                                    aipptFolderID = checkpage.ContentLink.ID.ToString();
                                                                    aipptFolderCRID = new ContentReference(aipptFolderID);

                                                                    //I need to find page under AIPPT folder if exist then no action item.
                                                                    //Therefore i need to set cdpageid = to this found page.
                                                                    var pageRef5 = new PageReference(aipptFolderCRID);
                                                                    var contentRepository5 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                                    var page5 = contentRepository5.Get<PageData>(pageRef5);
                                                                    PageDataCollection aipptPageList = new PageDataCollection();

                                                                    var ChildList4 = page5.GetDescendants(1);
                                                                    if (ChildList4 != null && ChildList4.Count() > 0)
                                                                    {
                                                                        aipptPageList = FindDescendantsOfPage(page5, aipptPageList);
                                                                    }

                                                                    if (aipptPageList != null && aipptPageList.Count > 0)
                                                                    {
                                                                        foreach (var aipptPage in aipptPageList)
                                                                        {
                                                                            if (aipptPage.Name == contentTitle)
                                                                            {
                                                                                cdpageid = aipptPage.ContentLink.ID.ToString();
                                                                                cdPageID = new ContentReference(cdpageid);
                                                                                break;
                                                                            }
                                                                        }
                                                                    }

                                                                }
                                                            }
                                                        }
                                                    }
                                                    //==
                                                    //Adding filter to check AIPPT folder exists under number container.
                                                    if (aipptTextExistInCAlias == 1)  
                                                    {
                                                        if (aipptFolderID == "")    
                                                        {
                                                            var createAIPPTFolder = CreateFolder(aipptDescription, numberNodeCRID);
                                                            createAIPPTFolder = ((EPiServer.Core.ContentReference)createAIPPTFolder).ID;
                                                            aipptFolderCRID = new ContentReference(createAIPPTFolder);
                                                        } 
                                                    }
                                                    //==
                                                    if(cdpageid != null && cdpageid.Length > 0)
                                                    {
                                                        //No action item, page exist in the system. I will discuss with Frank and Amy about this.
                                                    }
                                                    else
                                                    {
                                                        //Create a Article page
                                                        if (aipptTextExistInCAlias == 1) numberNodeCRID = aipptFolderCRID;
                                                        IContentRepository contentRepository = EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
                                                        var newPage = contentRepository.GetDefault<OJINContentDetailPage>(numberNodeCRID);
                                                        var introText = jsonRecord["ParseHtml"].ToString();
                                                        
                                                        //Commented following code as per Frank's suggestion dated on 26-APRIL
                                                        //var listOfImgdata = FetchImgsFromSource(introText);
                                                        //var newPath = "/assets/Ojin/img/";

                                                        //if (listOfImgdata?.Count > 0)
                                                        //{
                                                        //    foreach (var item in listOfImgdata)
                                                        //    {
                                                        //        var fileName = Path.GetFileName(item);
                                                        //        var imgSrc = newPath + fileName;
                                                        //        introText = Regex.Replace(introText, "<img.+?src=[\"'](.+?)[\"'].*?>", @"<img src='" + imgSrc + @"'/>");
                                                        //    }
                                                        //}
                                                        newPage.DocType = jsonRecord["DocumentType"].ToString();
                                                        newPage.Name = jsonRecord["ShortTitle"].ToString();   //ContentTitle
                                                        newPage.Title = jsonRecord["ContentTitle"].ToString();  //ContentTitle    //Changing from ShortTitle To ContentTitle=07-JUNE-22
                                                        newPage.ShortTitle = jsonRecord["ShortTitle"].ToString();
                                                        newPage.Created = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                        newPage.Changed = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                        newPage.PublicationDate = DateTime.Parse(jsonRecord["PublicationDate"].ToString());                                                        
                                                        newPage.IntroText = new XhtmlString(introText);
                                                        newPage.ShowSocial = true;                                                        
                                                        newPage.SearchTeaserText = jsonRecord["AbstractText"].ToString();
                                                        newPage.Abstract = new XhtmlString(jsonRecord["AbstractText"].ToString());
                                                        newPage.MetaTitle = jsonRecord["ContentTitle"].ToString();
                                                        newPage.MetaDescription = jsonRecord["AbstractText"].ToString();
                                                        newPage.MetaKeywords = jsonRecord["Keywords"].ToString();

                                                        //Commented following code as per Frank's suggestion dated on 26-APRIL, I am referring new fields for Volume and Issue
                                                        //var contentAlis = jsonRecord["ContentAlias"].ToString();
                                                        //if (contentAlis != null && contentAlis.Length > 0)
                                                        //{
                                                        //    var getVolume = FindBetweenString(contentAlis, "Vol-", "-");
                                                        //    getVolume = getVolume.Substring(0, 3);
                                                        //    getVolume = Regex.Match(getVolume, @"\d+").Value;
                                                        //    newPage.Volume = Convert.ToInt32(getVolume);
                                                        //    var getNumber = FindBetweenString(contentAlis, "/No", "-");
                                                        //    getNumber = Regex.Match(getNumber, @"\d+").Value;
                                                        //    newPage.Issue = Convert.ToInt32(getNumber);
                                                        //}

                                                        //Reading volume and issues from new fields of Json file.
                                                        // This should not trigger an error
                                                        // This is not something that would happen on a file.
                                                        var volume = jsonRecord["Volume"].ToString();
                                                        var number = jsonRecord["Number"].ToString();
                                                        if(volume != null && volume.Length > 0) newPage.Volume = Convert.ToInt32(volume); 
                                                        if(number != null && number.Length > 0) newPage.Issue = Convert.ToInt32(number);

                                                        newPage.OgContentType = "Article";                                                       
                                                        newPage.Citation = new XhtmlString(jsonRecord["Citation"].ToString());
                                                        var readDOI = jsonRecord["DOI"].ToString();
                                                        if (readDOI != null && readDOI.Length > 0)
                                                        {
                                                            var readOnlyDOI = FindBetweenString(readDOI, "DOI:</strong>", "<br>");
                                                            newPage.DOI = readOnlyDOI.ToString();
                                                        }
                                                        var getHRefOfDOI = getHref(readDOI);
                                                        if (getHRefOfDOI != null && getHRefOfDOI.Length > 0)
                                                        {
                                                            getHRefOfDOI = getHRefOfDOI.Length <= 6 ? "" : getHRefOfDOI.Remove(0, 5);
                                                            newPage.DOIURL = RemoveDoubleQuotes(getHRefOfDOI);
                                                        }
                                                        newPage.Keywords = new XhtmlString(jsonRecord["Keywords"].ToString());
                                                        newPage.References = new XhtmlString(jsonRecord["References"].ToString());
                                                        newPage.PreviousID = jsonRecord["ContentId"];                                                        
                                                        newPage.ChildSortOrder = EPiServer.Filters.FilterSortOrder.Alphabetical;                                                        
                                                        newPage.VisibleInMenu = false;                                                        
                                                        var contentAlisHtml = jsonRecord["ContentAlias"].ToString();
                                                        if (contentAlisHtml != "" && contentAlisHtml.Length > 5)
                                                        {
                                                            contentAlisHtml = contentAlisHtml.Remove(0, 4);
                                                        }                                                        
                                                        newPage.ExternalURL = contentAlisHtml;
                                                        

                                                        if (jsonRecord["KeywordPath"].ToString() != "")
                                                        {
                                                            var keyWordPathFromJSON = jsonRecord["KeywordPath"].ToString();
                                                            var ojinTopicSplit = keyWordPathFromJSON.Split('/');
                                                            var ojinTopic = ojinTopicSplit[ojinTopicSplit.Length - 4];
                                                            var ojinTitle = ojinTopicSplit[ojinTopicSplit.Length - 2];    
                                                            var ojinCategoryID = CreateTopicCategory(ojinTopic, ojinTitle);
                                                            newPage.Category.Add(Convert.ToInt32(ojinCategoryID));
                                                        }                                                        

                                                        contentRepository.Save(newPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);

                                                        
                                                        //==
                                                        //same author find then don't create the author block.
                                                        //Author name is the name of authorbioblock ==
                                                        var authorString = jsonRecord["AuthorModels"].ToString();
                                                        if (authorString != "")
                                                        {
                                                            var newPageID = newPage.ContentLink.ID;
                                                            var pageRef = new PageReference(newPageID);
                                                            var contentRepository1 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                            var page = contentRepository1.Get<PageData>(pageRef);
                                                            var pageContentLink = page.ContentLink;
                                                            
                                                            var repository = ServiceLocator.Current.GetInstance<IContentRepository>();
                                                            var cdPage = repository.Get<OJINContentDetailPage>(pageContentLink);
                                                            var contentDetailsPage = cdPage.CreateWritableClone() as OJINContentDetailPage;
                                                           
                                                            foreach (JObject authordata in jsonRecord["AuthorModels"])
                                                            {    
                                                                string authorName = (string)authordata["AuthorName"];
                                                                string authorEmail = (string)authordata["Email"];
                                                                string authorBio = (string)authordata["Bio"];
                                                                if (contentDetailsPage.Author == null) contentDetailsPage.Author = new ContentArea();
                                                               
                                                                //Earlier I was passing 'pageRef' as first parameter i.e. ParentID. until 21-April-2022
                                                                var authorCodeBlock = CreateAuthorBlock<AuthorBioBlock>
                                                                    (numberFolderCRIDForAuthor, authorName + "-" + appendAuthorNameData, authorName, authorEmail, authorBio);

                                                                contentDetailsPage.Author.Items.Add(
                                                                new ContentAreaItem
                                                                {
                                                                    ContentLink = authorCodeBlock
                                                                });                                                                                                                        
                                                            } 
                                                            //I do not get any exception, hence keeping this save method outside the loop to avoid more than one time save. 
                                                            repository.Save((IContent)contentDetailsPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
                                                        }
                                                    }

                                                }
                                                else
                                                {
                                                    //I need to create a Number Container and Article page.
                                                    var createNumberPage = CreateNumberPage(numDescription, volumeFolderCRID);
                                                    createNumberPage = ((EPiServer.Core.ContentReference)createNumberPage).ID;
                                                    numberNodeCRID = new ContentReference(createNumberPage);

                                                    //what will happen if the first json article is belongs to previous topics. I need to create a aippt folder and then create Article page underneath.
                                                    if (aipptTextExistInCAlias == 1)
                                                    {
                                                        var createAIPPTFolder = CreateFolder(aipptDescription, numberNodeCRID);
                                                        createAIPPTFolder = ((EPiServer.Core.ContentReference)createAIPPTFolder).ID;
                                                        aipptFolderCRID = new ContentReference(createAIPPTFolder);
                                                        numberNodeCRID = aipptFolderCRID;
                                                    }
                                                    //no action items on the existing logic to create the Article page under Number container.
                                                    IContentRepository contentRepository = EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
                                                    var newPage = contentRepository.GetDefault<OJINContentDetailPage>(numberNodeCRID);

                                                    var introText = jsonRecord["ParseHtml"].ToString();

                                                    //Commented following code as per Frank's suggestion dated on 26-APRIL
                                                    //var listOfImgdata = FetchImgsFromSource(introText);
                                                    //var newPath = "/assets/Ojin/img/";

                                                    //if (listOfImgdata?.Count > 0)
                                                    //{
                                                    //    foreach (var item in listOfImgdata)
                                                    //    {
                                                    //        var fileName = Path.GetFileName(item);
                                                    //        var imgSrc = newPath + fileName;
                                                    //        introText = Regex.Replace(introText, "<img.+?src=[\"'](.+?)[\"'].*?>", @"<img src='" + imgSrc + @"'/>");
                                                    //    }
                                                    //}

                                                    newPage.DocType = jsonRecord["DocumentType"].ToString();
                                                    newPage.Name = jsonRecord["ShortTitle"].ToString();   //ContentTitle
                                                    newPage.Title = jsonRecord["ContentTitle"].ToString();  //ContentTitle
                                                    newPage.ShortTitle = jsonRecord["ShortTitle"].ToString();
                                                    newPage.Created = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                    newPage.Changed = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                    newPage.PublicationDate = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                    newPage.IntroText = new XhtmlString(introText);
                                                    newPage.ShowSocial = true;                                                    
                                                    newPage.SearchTeaserText = jsonRecord["AbstractText"].ToString();
                                                    newPage.Abstract = new XhtmlString(jsonRecord["AbstractText"].ToString());
                                                    newPage.MetaTitle = jsonRecord["ContentTitle"].ToString();
                                                    newPage.MetaDescription = jsonRecord["AbstractText"].ToString();
                                                    newPage.MetaKeywords = jsonRecord["Keywords"].ToString();

                                                    //Commented following code as per Frank's suggestion dated on 26-APRIL, I am referring new fields for Volume and Issue
                                                    //var contentAlis = jsonRecord["ContentAlias"].ToString();
                                                    //if (contentAlis != null && contentAlis.Length > 0)
                                                    //{
                                                    //    var getVolume = FindBetweenString(contentAlis, "Vol-", "-");
                                                    //    getVolume = getVolume.Substring(0, 3);
                                                    //    getVolume = Regex.Match(getVolume, @"\d+").Value;
                                                    //    newPage.Volume = Convert.ToInt32(getVolume);
                                                    //    var getNumber = FindBetweenString(contentAlis, "/No", "-");
                                                    //    getNumber = Regex.Match(getNumber, @"\d+").Value;
                                                    //    newPage.Issue = Convert.ToInt32(getNumber);
                                                    //}

                                                    //Reading volume and issues from new fields of Json file.
                                                    var volume = jsonRecord["Volume"].ToString();
                                                    var number = jsonRecord["Number"].ToString();
                                                    if (volume != null && volume.Length > 0) newPage.Volume = Convert.ToInt32(volume);
                                                    if (number != null && number.Length > 0) newPage.Issue = Convert.ToInt32(number);

                                                    newPage.OgContentType = "Article";                                                    
                                                    newPage.Citation = new XhtmlString(jsonRecord["Citation"].ToString());
                                                    var readDOI = jsonRecord["DOI"].ToString();
                                                    if (readDOI != null && readDOI.Length > 0)
                                                    {
                                                        var readOnlyDOI = FindBetweenString(readDOI, "DOI:</strong>", "<br>");
                                                        newPage.DOI = readOnlyDOI.ToString();
                                                    }
                                                    var getHRefOfDOI = getHref(readDOI);
                                                    if (getHRefOfDOI != null && getHRefOfDOI.Length > 0)
                                                    {
                                                        getHRefOfDOI = getHRefOfDOI.Length <= 6 ? "" : getHRefOfDOI.Remove(0, 5);
                                                        newPage.DOIURL = RemoveDoubleQuotes(getHRefOfDOI);
                                                    }
                                                    newPage.Keywords = new XhtmlString(jsonRecord["Keywords"].ToString());
                                                    newPage.References = new XhtmlString(jsonRecord["References"].ToString());
                                                    newPage.PreviousID = jsonRecord["ContentId"];
                                                    newPage.ChildSortOrder = EPiServer.Filters.FilterSortOrder.Alphabetical;
                                                    newPage.VisibleInMenu = false;
                                                    var contentAlisHtml = jsonRecord["ContentAlias"].ToString();
                                                    if (contentAlisHtml != "" && contentAlisHtml.Length > 5)
                                                    {
                                                        contentAlisHtml = contentAlisHtml.Remove(0, 4);
                                                    }
                                                    newPage.ExternalURL = contentAlisHtml;

                                                    if (jsonRecord["KeywordPath"].ToString() != "")
                                                    {
                                                        var keyWordPathFromJSON = jsonRecord["KeywordPath"].ToString();
                                                        var ojinTopicSplit = keyWordPathFromJSON.Split('/');
                                                        var ojinTopic = ojinTopicSplit[ojinTopicSplit.Length - 4];
                                                        var ojinTitle = ojinTopicSplit[ojinTopicSplit.Length - 2];
                                                        var ojinCategoryID = CreateTopicCategory(ojinTopic, ojinTitle);
                                                        newPage.Category.Add(Convert.ToInt32(ojinCategoryID));
                                                    }

                                                    contentRepository.Save(newPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);

                                                    var authorString = jsonRecord["AuthorModels"].ToString();
                                                    if (authorString != "")
                                                    {
                                                        var newPageID = newPage.ContentLink.ID;
                                                        var pageRef = new PageReference(newPageID);
                                                        var contentRepository1 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                        var page = contentRepository1.Get<PageData>(pageRef);
                                                        var pageContentLink = page.ContentLink;
                                                        
                                                        var repository = ServiceLocator.Current.GetInstance<IContentRepository>();
                                                        var cdPage = repository.Get<OJINContentDetailPage>(pageContentLink);
                                                        var contentDetailsPage = cdPage.CreateWritableClone() as OJINContentDetailPage;

                                                        foreach (JObject authordata in jsonRecord["AuthorModels"])
                                                        {

                                                            string authorName = (string)authordata["AuthorName"];
                                                            string authorEmail = (string)authordata["Email"];
                                                            string authorBio = (string)authordata["Bio"];
                                                            if (contentDetailsPage.Author == null) contentDetailsPage.Author = new ContentArea();

                                                            //Earlier I was passing 'pageRef' as first parameter i.e. ParentID. until 21-April-2022
                                                            var authorCodeBlock = CreateAuthorBlock<AuthorBioBlock>
                                                                (numberFolderCRIDForAuthor, authorName +"-"+ appendAuthorNameData, authorName, authorEmail, authorBio);

                                                            contentDetailsPage.Author.Items.Add(
                                                            new ContentAreaItem
                                                            {
                                                                ContentLink = authorCodeBlock
                                                            });                                                                                                                                                                                        
                                                        }
                                                        repository.Save((IContent)contentDetailsPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
                                                    }
                                                }


                                            }
                                            else
                                            {
                                                //I need to create a Listing page with NumberConte and Article page. In case I don't find anything in Numer container.
                                                                                              
                                                var createNumberPage = CreateNumberPage(numDescription, volumeFolderCRID);
                                                createNumberPage = ((EPiServer.Core.ContentReference)createNumberPage).ID;
                                                numberNodeCRID = new ContentReference(createNumberPage);

                                                if (aipptTextExistInCAlias == 1)
                                                {
                                                    var createAIPPTFolder = CreateFolder(aipptDescription, numberNodeCRID);
                                                    createAIPPTFolder = ((EPiServer.Core.ContentReference)createAIPPTFolder).ID;
                                                    aipptFolderCRID = new ContentReference(createAIPPTFolder);
                                                    numberNodeCRID = aipptFolderCRID;
                                                }

                                                IContentRepository contentRepository = EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
                                                var newPage = contentRepository.GetDefault<OJINContentDetailPage>(numberNodeCRID);

                                                var introText = jsonRecord["ParseHtml"].ToString();

                                                //Commented following code as per Frank's suggestion dated on 26-APRIL
                                                //var listOfImgdata = FetchImgsFromSource(introText);

                                                //var newPath = "/assets/Ojin/img/";

                                                //if (listOfImgdata?.Count > 0)
                                                //{
                                                //    foreach (var item in listOfImgdata)
                                                //    {
                                                //        var fileName = Path.GetFileName(item);
                                                //        var imgSrc = newPath + fileName;
                                                //        introText = Regex.Replace(introText, "<img.+?src=[\"'](.+?)[\"'].*?>", @"<img src='" + imgSrc + @"'/>");
                                                //    }
                                                //} 

                                                newPage.DocType = jsonRecord["DocumentType"].ToString();
                                                newPage.Name = jsonRecord["ShortTitle"].ToString();   //ContentTitle
                                                newPage.Title = jsonRecord["ContentTitle"].ToString();    //ContentTitle
                                                newPage.ShortTitle = jsonRecord["ShortTitle"].ToString();
                                                newPage.Created = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                newPage.Changed = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                                newPage.PublicationDate = DateTime.Parse(jsonRecord["PublicationDate"].ToString());                                                
                                                newPage.IntroText = new XhtmlString(introText);
                                                newPage.ShowSocial = true;                                                
                                                newPage.SearchTeaserText = jsonRecord["AbstractText"].ToString();                                                
                                                newPage.Abstract = new XhtmlString(jsonRecord["AbstractText"].ToString());
                                                newPage.MetaTitle = jsonRecord["ContentTitle"].ToString();
                                                newPage.MetaDescription = jsonRecord["AbstractText"].ToString();
                                                newPage.MetaKeywords = jsonRecord["Keywords"].ToString();

                                                //Commented following code as per Frank's suggestion dated on 26-APRIL, I am referring new fields for Volume and Issue
                                                //var contentAlis = jsonRecord["ContentAlias"].ToString();
                                                //if (contentAlis != null && contentAlis.Length > 0)
                                                //{
                                                //    var getVolume = FindBetweenString(contentAlis, "Vol-", "-");
                                                //    getVolume = getVolume.Substring(0, 3);
                                                //    getVolume = Regex.Match(getVolume, @"\d+").Value;
                                                //    newPage.Volume = Convert.ToInt32(getVolume);
                                                //    var getNumber = FindBetweenString(contentAlis, "/No", "-");
                                                //    getNumber = Regex.Match(getNumber, @"\d+").Value;
                                                //    newPage.Issue = Convert.ToInt32(getNumber);
                                                //}

                                                //Reading volume and issues from new fields of Json file.
                                                var volume = jsonRecord["Volume"].ToString();
                                                var number = jsonRecord["Number"].ToString();
                                                if (volume != null && volume.Length > 0) newPage.Volume = Convert.ToInt32(volume);
                                                if (number != null && number.Length > 0) newPage.Issue = Convert.ToInt32(number);

                                                newPage.OgContentType = "Article";
                                                var citation = jsonRecord["Citation"].ToString();
                                                newPage.Citation = new XhtmlString(jsonRecord["Citation"].ToString());

                                                var readDOI = jsonRecord["DOI"].ToString();
                                                if (readDOI != null && readDOI.Length > 0)
                                                {
                                                    var readOnlyDOI = FindBetweenString(readDOI, "DOI:</strong>", "<br>");
                                                    newPage.DOI = readOnlyDOI.ToString();
                                                }

                                                var getHRefOfDOI = getHref(readDOI);
                                                if (getHRefOfDOI != null && getHRefOfDOI.Length > 0)
                                                {
                                                    getHRefOfDOI = getHRefOfDOI.Length <= 6 ? "" : getHRefOfDOI.Remove(0, 5);
                                                    newPage.DOIURL = RemoveDoubleQuotes(getHRefOfDOI);
                                                }

                                                newPage.Keywords = new XhtmlString(jsonRecord["Keywords"].ToString());
                                                newPage.References = new XhtmlString(jsonRecord["References"].ToString());
                                                newPage.PreviousID = jsonRecord["ContentId"];                                                
                                                newPage.ChildSortOrder = EPiServer.Filters.FilterSortOrder.Alphabetical;                                                
                                                newPage.VisibleInMenu = false;                                               
                                                var contentAlisHtml = jsonRecord["ContentAlias"].ToString();
                                                if (contentAlisHtml != "" && contentAlisHtml.Length > 5)
                                                {
                                                    contentAlisHtml = contentAlisHtml.Remove(0, 4);
                                                }
                                               
                                                newPage.ExternalURL = contentAlisHtml;   //jsonRecord["ContentAlias"].ToString();

                                                if (jsonRecord["KeywordPath"].ToString() != "")
                                                {
                                                    var keyWordPathFromJSON = jsonRecord["KeywordPath"].ToString();
                                                    var ojinTopicSplit = keyWordPathFromJSON.Split('/');
                                                    var ojinTopic = ojinTopicSplit[ojinTopicSplit.Length - 4];
                                                    var ojinTitle = ojinTopicSplit[ojinTopicSplit.Length - 2];
                                                    var ojinCategoryID = CreateTopicCategory(ojinTopic, ojinTitle);
                                                    newPage.Category.Add(Convert.ToInt32(ojinCategoryID));
                                                }

                                                contentRepository.Save(newPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);

                                                var authorString = jsonRecord["AuthorModels"].ToString();
                                                if (authorString != "")
                                                {
                                                    var newPageID = newPage.ContentLink.ID;
                                                    var pageRef = new PageReference(newPageID);
                                                    var contentRepository1 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                    var page = contentRepository1.Get<PageData>(pageRef);
                                                    var pageContentLink = page.ContentLink;
                                                    
                                                    var repository = ServiceLocator.Current.GetInstance<IContentRepository>();
                                                    var cdPage = repository.Get<OJINContentDetailPage>(pageContentLink);
                                                    var contentDetailsPage = cdPage.CreateWritableClone() as OJINContentDetailPage;

                                                    foreach (JObject authordata in jsonRecord["AuthorModels"])
                                                    {

                                                        string authorName = (string)authordata["AuthorName"];
                                                        string authorEmail = (string)authordata["Email"];
                                                        string authorBio = (string)authordata["Bio"];
                                                        if (contentDetailsPage.Author == null) contentDetailsPage.Author = new ContentArea();

                                                        //Earlier I was passing 'pageRef' as first parameter i.e. ParentID. until 21-April-2022
                                                        var authorCodeBlock = CreateAuthorBlock<AuthorBioBlock>
                                                            (numberFolderCRIDForAuthor, authorName +"-"+ appendAuthorNameData, authorName, authorEmail, authorBio);

                                                        contentDetailsPage.Author.Items.Add(
                                                        new ContentAreaItem
                                                        {
                                                            ContentLink = authorCodeBlock
                                                        });                                                                                                                        
                                                    }
                                                    repository.Save((IContent)contentDetailsPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
                                                }
                                            }
                                        }
                                        else
                                        {
                                            var createVolumeFolder = CreateFolder(volDescription, parentPage);
                                            createVolumeFolder = ((EPiServer.Core.ContentReference)createVolumeFolder).ID;                                            
                                            volumeFolderCRID = new ContentReference(createVolumeFolder);

                                            var createNumberPage = CreateNumberPage(numDescription, volumeFolderCRID);
                                            createNumberPage = ((EPiServer.Core.ContentReference)createNumberPage).ID;
                                            numberNodeCRID = new ContentReference(createNumberPage);

                                            if (aipptTextExistInCAlias == 1)
                                            {
                                                var createAIPPTFolder = CreateFolder(aipptDescription, numberNodeCRID);
                                                createAIPPTFolder = ((EPiServer.Core.ContentReference)createAIPPTFolder).ID;
                                                aipptFolderCRID = new ContentReference(createAIPPTFolder);
                                                numberNodeCRID = aipptFolderCRID;
                                            }

                                            IContentRepository contentRepository =
                                            EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
                                            var newPage = contentRepository.GetDefault<OJINContentDetailPage>(numberNodeCRID);

                                            var introText = jsonRecord["ParseHtml"].ToString();

                                            //Commented following code as per Frank's suggestion dated on 26-APRIL
                                            //var listOfImgdata = FetchImgsFromSource(introText);

                                            //var newPath = "/assets/Ojin/img/";

                                            //if (listOfImgdata?.Count > 0)
                                            //{
                                            //    foreach (var item in listOfImgdata)
                                            //    {
                                            //        var fileName = Path.GetFileName(item);
                                            //        var imgSrc = newPath + fileName;
                                            //        introText = Regex.Replace(introText, "<img.+?src=[\"'](.+?)[\"'].*?>", @"<img src='" + imgSrc + @"'/>");
                                            //    }
                                            //}

                                            newPage.DocType = jsonRecord["DocumentType"].ToString();
                                            newPage.Name = jsonRecord["ShortTitle"].ToString();   //ContentTitle
                                            newPage.Title = jsonRecord["ContentTitle"].ToString();  //ContentTitle
                                            newPage.ShortTitle = jsonRecord["ShortTitle"].ToString();
                                            newPage.Created = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                            newPage.Changed = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                            newPage.PublicationDate = DateTime.Parse(jsonRecord["PublicationDate"].ToString());
                                            newPage.IntroText = new XhtmlString(introText);
                                            newPage.ShowSocial = true;
                                            newPage.SearchTeaserText = jsonRecord["AbstractText"].ToString();                                            
                                            newPage.Abstract = new XhtmlString(jsonRecord["AbstractText"].ToString());
                                            newPage.MetaTitle = jsonRecord["ContentTitle"].ToString();
                                            newPage.MetaDescription = jsonRecord["AbstractText"].ToString();
                                            newPage.MetaKeywords = jsonRecord["Keywords"].ToString();

                                            //Commented following code as per Frank's suggestion dated on 26-APRIL, I am referring new fields for Volume and Issue
                                            //var contentAlis = jsonRecord["ContentAlias"].ToString();
                                            //if (contentAlis != null && contentAlis.Length > 0)
                                            //{
                                            //    var getVolume = FindBetweenString(contentAlis, "Vol-", "-");
                                            //    getVolume = getVolume.Substring(0, 3);
                                            //    getVolume = Regex.Match(getVolume, @"\d+").Value;
                                            //    newPage.Volume = Convert.ToInt32(getVolume);
                                            //    var getNumber = FindBetweenString(contentAlis, "/No", "-");
                                            //    getNumber = Regex.Match(getNumber, @"\d+").Value;
                                            //    newPage.Issue = Convert.ToInt32(getNumber);
                                            //}

                                            //Reading volume and issues from new fields of Json file.
                                            var volume = jsonRecord["Volume"].ToString();
                                            var number = jsonRecord["Number"].ToString();
                                            if (volume != null && volume.Length > 0) newPage.Volume = Convert.ToInt32(volume);
                                            if (number != null && number.Length > 0) newPage.Issue = Convert.ToInt32(number);

                                            newPage.OgContentType = "Article";
                                            var citation = jsonRecord["Citation"].ToString();
                                            newPage.Citation = new XhtmlString(jsonRecord["Citation"].ToString());

                                            var readDOI = jsonRecord["DOI"].ToString();
                                            if (readDOI != null && readDOI.Length > 0)
                                            {
                                                var readOnlyDOI = FindBetweenString(readDOI, "DOI:</strong>", "<br>");
                                                newPage.DOI = readOnlyDOI.ToString();
                                            }
                                            var getHRefOfDOI = getHref(readDOI);
                                            if (getHRefOfDOI != null && getHRefOfDOI.Length > 0)
                                            {
                                                getHRefOfDOI = getHRefOfDOI.Length <= 6 ? "" : getHRefOfDOI.Remove(0, 5);
                                                newPage.DOIURL = RemoveDoubleQuotes(getHRefOfDOI);
                                            }
                                            newPage.Keywords = new XhtmlString(jsonRecord["Keywords"].ToString());
                                            newPage.References = new XhtmlString(jsonRecord["References"].ToString());
                                            newPage.PreviousID = jsonRecord["ContentId"];                                            
                                            newPage.ChildSortOrder = EPiServer.Filters.FilterSortOrder.Alphabetical;                                            
                                            newPage.VisibleInMenu = false;                                           
                                            
                                            var contentAlisHtml = jsonRecord["ContentAlias"].ToString();
                                            if (contentAlisHtml != "" && contentAlisHtml.Length > 5)
                                            {
                                                contentAlisHtml = contentAlisHtml.Remove(0,4);
                                            }                                           
                                            newPage.ExternalURL = contentAlisHtml;   //jsonRecord["ContentAlias"].ToString();                                           

                                            if (jsonRecord["KeywordPath"].ToString() != "")
                                            {
                                                var keyWordPathFromJSON = jsonRecord["KeywordPath"].ToString();
                                                var ojinTopicSplit = keyWordPathFromJSON.Split('/');
                                                var ojinTopic = ojinTopicSplit[ojinTopicSplit.Length - 4];
                                                var ojinTitle = ojinTopicSplit[ojinTopicSplit.Length - 2];
                                                var ojinCategoryID = CreateTopicCategory(ojinTopic, ojinTitle);
                                                newPage.Category.Add(Convert.ToInt32(ojinCategoryID));
                                            }

                                            contentRepository.Save(newPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);

                                            var authorString = jsonRecord["AuthorModels"].ToString();
                                            if (authorString != "")
                                            {
                                                var newPageID = newPage.ContentLink.ID;
                                                var pageRef = new PageReference(newPageID);
                                                var contentRepository1 = ServiceLocator.Current.GetInstance<IContentLoader>();
                                                var page = contentRepository1.Get<PageData>(pageRef);
                                                var pageContentLink = page.ContentLink;
                                                
                                                var repository = ServiceLocator.Current.GetInstance<IContentRepository>();
                                                var cdPage = repository.Get<OJINContentDetailPage>(pageContentLink);
                                                var contentDetailsPage = cdPage.CreateWritableClone() as OJINContentDetailPage;

                                                foreach (JObject authordata in jsonRecord["AuthorModels"])
                                                {

                                                    string authorName = (string)authordata["AuthorName"];
                                                    string authorEmail = (string)authordata["Email"];
                                                    string authorBio = (string)authordata["Bio"];
                                                    if (contentDetailsPage.Author == null) contentDetailsPage.Author = new ContentArea();

                                                    //Earlier I was passing 'pageRef' as first parameter i.e. ParentID. until 21-April-2022
                                                    var authorCodeBlock = CreateAuthorBlock<AuthorBioBlock>
                                                        (numberFolderCRIDForAuthor, authorName +"-"+ appendAuthorNameData, authorName, authorEmail, authorBio);

                                                    contentDetailsPage.Author.Items.Add(
                                                    new ContentAreaItem
                                                    {
                                                        ContentLink = authorCodeBlock
                                                    });                                                                                                                                                                                 
                                                }
                                                repository.Save((IContent)contentDetailsPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
                                            }
                                        }                                       
                                        
                                        i++;
                                    }

                                    catch (Exception ex)
                                    {
                                        Logger("Please verify details of ContentID : " + logContentID + " Content Title: " + logContentTitle + " Content Alias: " + logContentAlias +  " Error Message:" + ex.Message + " in JSON File", path1);
                                        var msg = ex.Message;
                                        j++;
                                    }
                                }
                                ViewBag.Error = "Number of records imported successfully: " + i
                                                + "<br /><br />"
                                                + "Number of records failed to import: " + j;

                            }

                        }
                        else
                        {
                            ViewBag.Error = "JSON file is empty or not a valid JSON Data";
                        }
                    }
                    else
                    {
                        ViewBag.Error = "Please Upload File in .json format";
                    }
                }
                else
                {
                    ViewBag.Error = "file not found";
                }
            /*}
            else
            {
                ViewBag.Error = "Please assign 'Table of Content' ID from your system/database in webconfig file. The key is 'ParentFolderIDTOC' ";
            }*/
            return View();

        }

        public static string SplitRecordsFromString(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            string pattern = "<p id=";
            Regex rgx = new Regex(pattern);
            string result = rgx.Replace(source, "");
            return result;
        }

        /// <summary>
        /// keeping this function can be used for further requirement.
        /// </summary>
        /// <param name="strFilePath"></param>
        /// <returns></returns>
        public static DataTable ConvertJSONtoDataTable(string strFilePath)
        {
            DataTable dt = new DataTable();
            using (StreamReader sr = new StreamReader(strFilePath))
            {
                string[] headers = sr.ReadLine().Split(',');
                foreach (string header in headers)
                {
                    dt.Columns.Add(header);
                }

                while (!sr.EndOfStream)
                {
                    string[] rows = sr.ReadLine().Split(',');
                    if (rows.Length > 1)
                    {
                        DataRow dr = dt.NewRow();
                        for (int i = 0; i < headers.Length; i++)
                        {
                            dr[i] = rows[i].Trim();
                        }
                        dt.Rows.Add(dr);
                    }
                }

            }


            return dt;
        }
        /// <summary>
        /// pattern to check "ArticlePreviousTopic" in ContentAlias field.
        /// </summary>
        /// <param name="cAlias"></param>
        /// <returns></returns>
        private int aipptTextExistInCAlias_New(string cAlias)
        { 
            var aipptTextExistInCAlias = 0;
            if (cAlias == null) return aipptTextExistInCAlias;
            if (cAlias.Contains("ArticlePreviousTopic") == true) aipptTextExistInCAlias = 1;
            return aipptTextExistInCAlias;
        }

        /// <summary>
        /// pattern to check "ArticlePreviousTopic" in ContentAlias field.
        /// </summary>
        /// <param name="cAlias"></param>
        /// <returns></returns>
        private int aipptTextExistInCAlias(string cAlias)
        {           
            var aipptTextExistInCAlias = 0;
            if (cAlias == null) return aipptTextExistInCAlias;
            var checkText = FindBetweenString(cAlias, "No3Sept01/", "/BONsList");
            if (checkText == "ArticlePreviousTopic") aipptTextExistInCAlias = 1;
            return aipptTextExistInCAlias;
        }

        /// <summary>
        /// This function is used to find string between two string.
        /// </summary>
        /// <param name="value"></param>
        /// <param name="a"></param>
        /// <param name="b"></param>
        /// <returns></returns>
        public static string FindBetweenString(string value, string a, string b)
        {
            int posA = value.IndexOf(a);
            int posB = value.LastIndexOf(b);
            if (posA == -1)
            {
                return "";
            }
            if (posB == -1)
            {
                return "";
            }
            int adjustedPosA = posA + a.Length;
            if (adjustedPosA >= posB)
            {
                return "";
            }
            return value.Substring(adjustedPosA, posB - adjustedPosA);
        }

        public static string GetVolumeContainerName(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            var volumeName = "";
            source = source.Trim();
            var volNumber = Regex.Match(source, @"\d+").Value;
            var volYear = source.Substring(source.Length - 4);
            volumeName = "Vol" + "-" + volNumber + "-" + volYear;
            return volumeName;
        }
        public static string GetNumberContainerName(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            var numberName = "";
            source = source.Trim();
            var volNumber = Regex.Match(source, @"\d+").Value;
            var numMonth = source.Substring(source.LastIndexOf(":") + 1);            
            var numMonth3 = numMonth.Trim();
            numMonth3 = numMonth3.Substring(0, 3);            
            var volYear = source.Substring(source.Length - 4);
            numberName = "No" + volNumber + "-" + numMonth3 + "-" + volYear;
            return numberName;
        }

        /// <summary>
        /// This function is used to remove markup from string.
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        public static string StripTagsRegex(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            return Regex.Replace(source, "<.*?>", string.Empty);
        }
        /// <summary>
        /// This function is used to remove Double Quotes from string.
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        public static string RemoveDoubleQuotes(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            string pattern = @"^\s*""?|""?\s*$";
            Regex rgx = new Regex(pattern);
            string result = rgx.Replace(source, "");
            return result;
        }
        /// <summary>
        /// This function will return you the Href url from your string.
        /// </summary>
        /// <param name="source"></param>
        /// <returns></returns>
        public static string getHref(string source)
        {
            if (string.IsNullOrEmpty(source)) return null;
            var hRef = "";
            Regex regex = new Regex("href\\s*=\\s*(?:\"(?<1>[^\"]*)\"|(?<1>\\S+))", RegexOptions.IgnoreCase);
            Match match;
            for (match = regex.Match(source); match.Success; match = match.NextMatch())
            {
                foreach (Group group in match.Groups)
                {
                    hRef = group.ToString();
                    break;
                }
            }
            return hRef;
        }

        /// <summary>
        /// If file doesn't exist, create a file.
        /// </summary>
        /// <param name="path"></param>
        public static void VerifyDirectory(string path)
        {
            try
            {
                DirectoryInfo dir = new DirectoryInfo(path);
                if (!dir.Exists)
                {
                    dir.Create();
                }
            }
            catch { }
        }
        /// <summary>
        /// Log the data, in case you don'e find Volumen Container is blank.
        /// </summary>
        /// <param name="lines"></param>
        /// <param name="path"></param>
        public static void Logger(string lines, string path)
        {
            //string path = "C:/Log/";  //We can hardcode the path down the line, if required.
            VerifyDirectory(path);
            string fileName = DateTime.Now.Day.ToString() + DateTime.Now.Month.ToString() + DateTime.Now.Year.ToString() + "_Logs.txt";
            try
            {
                System.IO.StreamWriter file = new System.IO.StreamWriter(path + fileName, true);
                file.WriteLine(DateTime.Now.ToString() + ": " + lines);
                file.Close();
            }
            catch (Exception) { }
        }

        /// <summary>
        /// This function is used to find folder/pages existing or not.
        /// </summary>
        /// <param name="pageData"></param>
        /// <param name="descendants"></param>
        /// <returns></returns>
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
        /// <summary>
        /// This method will create Content Folder folder inside Blocks.
        /// </summary>
        /// <param name="folderName"></param>
        /// <param name="parentReference"></param>
        /// <returns></returns>
        public ContentReference CreateContentFolder(string folderName, ContentReference parentReference)
        {
            var contentRepository = ServiceLocator.Current.GetInstance<IContentRepository>();
            var contentFile = contentRepository.GetDefault<ContentFolder>(parentReference);
            contentFile.Name = folderName;
            return contentRepository.Save(contentFile, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
        }


        /// <summary>
        /// ContentFolder
        /// </summary>
        /// <param name="folderName"></param>
        /// <param name="parentReference"></param>
        /// <returns></returns>
        public ContentReference CreateFolder(string folderName, ContentReference parentReference)
        {
            var contentRepository = ServiceLocator.Current.GetInstance<IContentRepository>();
            var contentFile = contentRepository.GetDefault<FolderPage>(parentReference);
            contentFile.Name = folderName;
            return contentRepository.Save(contentFile, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);
        }
        /// <summary>
        /// Create Number Container Listing page.
        /// This function updated dated on 09-MAY-2022
        /// </summary>
        /// <param name="numberDescription"></param>
        /// <param name="parentReference"></param>
        /// <returns></returns>
        public ContentReference CreateNumberPage(string numberDescription, ContentReference parentReference)
        {           
            IContentRepository contentRepository =
                                            EPiServer.ServiceLocation.ServiceLocator.Current.GetInstance<IContentRepository>();
            var newNumberPage = contentRepository.GetDefault<OJINBaseListingPage>(parentReference);

            newNumberPage.Name = numberDescription;
            newNumberPage.Title = numberDescription;
            newNumberPage.ShowAuthors = true;
            newNumberPage.ShowPubDate = true;
            newNumberPage.ShowNoOfArticles = true;
            newNumberPage.TypeofListing = "Child Item"; // "Category Tag";   //Modified on 09-MAY-2022

            return contentRepository.Save(newNumberPage, EPiServer.DataAccess.SaveAction.Publish, EPiServer.Security.AccessLevel.NoAccess);                       

        }
        /// <summary>
        /// Create Topic Category based on parent category and category title.
        /// </summary>
        /// <param name="ojinTopicParentCategory"></param>
        /// <param name="categoryTitle"></param>
        /// <returns></returns>
        public int CreateTopicCategory(string ojinTopicParentCategory, string categoryTitle)
        {
            var categoryID = 0;
            var categoryRepository = ServiceLocator.Current.GetInstance<CategoryRepository>();
            var newOjinTopicCategory = categoryRepository.Get(categoryTitle);
            
            //var catID = CreateIfNotExists(categoryTitle, "Ravi", 0);
            var catID = GetCategoryID(categoryTitle);

            if(catID > 0)
            {
                categoryID = catID;
            }
            else
            {
                try
                {
                    var parentCategory = categoryRepository.Get(ojinTopicParentCategory);

                    newOjinTopicCategory = new Category(parentCategory, categoryTitle)
                    {
                        Name = categoryTitle,
                        Parent = parentCategory,
                        Selectable = true,
                        Description = categoryTitle
                    };

                    categoryRepository.Save(newOjinTopicCategory);
                    
                }
                catch (Exception ex)
                {
                    categoryID = newOjinTopicCategory.ID;
                    var msg = ex.InnerException;
                    if (msg == null)
                    {
                        categoryID = GetCategoryID(categoryTitle);
                    }
                }
            }

            if (categoryID <=0)
            {
                categoryID = GetCategoryID(categoryTitle);
            }
            return categoryID; 

            /*
            if (newOjinTopicCategory == null)
            {
                try
                {
                    var parentCategory = categoryRepository.Get(ojinTopicParentCategory);//"OJIN Topics");//ojinTopicParentCategory);

                    newOjinTopicCategory = new Category(parentCategory, categoryTitle)
                    {
                        Name = categoryTitle,
                        Parent = parentCategory,
                        Selectable = true,
                        Description = categoryTitle
                    };

                    categoryRepository.Save(newOjinTopicCategory);
                }
                catch (Exception ex)
                {
                    var msg = ex.InnerException;
                }
            }

            return (newOjinTopicCategory.ID).ToString();
            */
        }

        /// <summary>
        /// Get Category ID based on Category Name
        /// </summary>
        /// <param name="categoryName"></param>
        /// <returns></returns>
        private int GetCategoryID(string categoryName)
        {
            var categoryID = 0;
            if(string.IsNullOrEmpty(categoryName))
            { return categoryID; }
            var categoryRepo = ServiceLocator.Current.GetInstance<CategoryRepository>();
            var rootCategory = categoryRepo.GetRoot();
            CategoryCollection childCategories = rootCategory.Categories;
            foreach (Category category1 in childCategories)
            {
                var a1 = category1.Categories;
                if (a1.Count > 0)
                {
                    foreach (Category category2 in category1.Categories)
                    {
                        var a2 = category2.Categories;
                        if (a2.Count > 0)
                        {
                            //var a3 = category2
                            foreach (Category category3 in category2.Categories)
                            {
                                if (category3.Description == categoryName)
                                {
                                    categoryID = category3.ID;
                                }
                            }
                        }

                    }
                }                
            }

            return categoryID;           
        }

        public static TResult CreateBlockForPage<TResult>(ContentReference pageReference, string newBlockName,
            SaveAction saveAction = SaveAction.Publish, AccessLevel accessLevel = AccessLevel.NoAccess)
            where TResult : BlockData
        {
            var repository = ServiceLocator.Current.GetInstance<IContentRepository>();

            var assetsFolderForPage = ServiceLocator.Current
                .GetInstance<ContentAssetHelper>()
                .GetOrCreateAssetFolder(pageReference);

            var blockInstance = repository.GetDefault<TResult>(assetsFolderForPage.ContentLink);
            var blockForPage = blockInstance as IContent;

            blockForPage.Name = newBlockName;

            repository.Save(blockForPage, saveAction, accessLevel);
            return blockInstance;
        }
        /// <summary>
        /// This function will create Author block records.
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="pageReference"></param>
        /// <param name="newBlockName"></param>
        /// <param name="authorName"></param>
        /// <param name="emailData"></param>
        /// <param name="bioData"></param>
        /// <param name="saveAction"></param>
        /// <param name="accessLevel"></param>
        /// <returns></returns>
        public static ContentReference CreateAuthorBlock<TResult>(ContentReference pageReference, string newBlockName,
            string authorName, string emailData, string bioData,
            SaveAction saveAction = SaveAction.Publish, AccessLevel accessLevel = AccessLevel.NoAccess)
            where TResult : AuthorBioBlock
        {
            var repository = ServiceLocator.Current.GetInstance<IContentRepository>();           

            var authorbblock = repository.GetDefault<AuthorBioBlock>(pageReference);
            authorbblock.AuthorName = authorName;
            authorbblock.Email = emailData;
            authorbblock.Bio = new XhtmlString(bioData);

            var content = authorbblock as IContent;
            content.Name = newBlockName;
            ContentReference newBlocksRef =
                repository.Save(content, saveAction, accessLevel);

            return newBlocksRef;

        }

        /// <summary>
        /// Get BlockID based on AuthorBlockName.
        /// </summary>
        /// <param name="authorBlockName"></param>
        /// <returns></returns>
        private int GetAuthorBlockID(string authorBlockName)
        {
            int authorBlockID = 0;
            
            var contentTypeRepository = ServiceLocator.Current.GetInstance<IContentTypeRepository>();
            var contentModelUsage = ServiceLocator.Current.GetInstance<IContentModelUsage>();

            // get the complete list of AuthorBioBlock
            var contentType = contentTypeRepository.Load<AuthorBioBlock>();
            var contentUsages = contentModelUsage.ListContentOfContentType(contentType);

            foreach (var allAuthors in contentUsages)
            { 
                if(allAuthors.Name == authorBlockName)
                {
                    authorBlockID = allAuthors.ContentLink.ID;
                    break;
                }
            }

            return authorBlockID;
        }

        /// <summary>
        /// This is RND to get category id to set in CD page.
        /// </summary>
        /// <param name="name"></param>
        /// <param name="description"></param>
        /// <param name="order"></param>
        /// <returns></returns>
        private int CreateIfNotExists(string name, string description, int order)
        {
            var categoryID = 0;
            
            if (string.IsNullOrEmpty(name))
            {
                throw new ArgumentNullException("name");
            }
            if (string.IsNullOrEmpty(description))
            {
                throw new ArgumentNullException("description");
            }

            var categoryRepo = ServiceLocator.Current.GetInstance<CategoryRepository>();
            var rootCategory = categoryRepo.GetRoot();
            CategoryCollection childCategories = rootCategory.Categories;
            foreach (Category category1 in childCategories)
            {
                var a1 = category1.Categories;
                if (a1.Count > 0)
                {
                    foreach (Category category2 in category1.Categories)
                    {
                        var a2 = category2.Categories;
                        if (a2.Count > 0)
                        {
                            //var a3 = category2
                            foreach (Category category3 in category2.Categories)
                            {
                                if (category3.Description == name)
                                {
                                    categoryID = category3.ID;
                                }
                            }
                        }

                    }
                }
                //var aaa = a1.GetChildCategories;

                //var a12 = a1.GetEnumerator();
                //if (a1.GetChildCategories(35));  // != null)
                //{ 
                //}
                // do whatever
                //if (category1.Name == name)
                //{
                //    categoryID = category1.ID;
                //    break;
                //}
            }

            return categoryID;
            //public static CategoryList LoadCategories()

            //var categories = CategoryList();    //.LoadCategories();
            //if (categories.Contains(name))
            //{
            //    return;
            //}

            //var category = new Category(name, description)
            //{
            //    Available = true,
            //    Parent = Category.RootName();   //.GetRoot(),
            //    SortOrder = order
            //};

            //category.Save();
        }

        /// <summary>
        /// Remove invalid character from string
        /// </summary>
        /// <param name="stringValue">string with invalid characters </param>
        /// <returns>string with invalid characters </returns>
        string RemoveInvalidCharacter(string stringValue)
        {

            stringValue = stringValue.Replace("Â", "");
            stringValue = stringValue.Replace("â€™", "'");
            stringValue = stringValue.Replace("â€œ", "'");
            stringValue = stringValue.Replace("â€“", "-");
            stringValue = stringValue.Replace("â€", "'");

            return stringValue;
        }
    }
}
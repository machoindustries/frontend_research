using EPiServer.Cms.TinyMce.Core;

namespace ANA_HNHN.Extensions;

public static class TinyMceSettingsExtensions
{
	public static TinyMceSettings UseDefaultStyles(this TinyMceSettings settings)
	{
		return settings
			.DisableMenubar()
			.AddEpiserverSupport()
			.AddPlugin("media wordcount anchor table code searchreplace")
			.Toolbar("table | removeformat | blocks epi-create-block | epi-link anchor image epi-image-editor media epi-personalized-content | epi-dnd-processor | cut copy paste pastetext | fullscreen code | bold italic | bullist numlist outdent indent | styles | fontfamily | undo redo superscript subscript hr | searchreplace underline alignleft aligncenter alignright alignjustify")
			.AddSetting("extended_valid_elements", "script[language|type|src]")
			.BlockFormats("Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4;Heading 5=h5;Heading 6=h6;Blockquote=blockquote;Preformatted=pre;")
			.StyleFormats(
			new
			{
				title = "Button Styles",
				items = new[]
				{
					new { title = "Primary Button", selector = "a", classes = "btn btn-primary" },
					new { title = "Secondary Button", selector = "a", classes = "btn btn-secondary" }
				}
			},
			new
			{
				title = "Content Styles",
				items = new[]
				{
					new { title = "Lead", selector = "p", classes = "lead" }
				}
			})
			.AddSiteCss("/assets/hnhn/tinymce/editor.css")
			.Height(600)
			.Width(628)
			.Resize(TinyMceResize.Both);
	}

	public static TinyMceSettings UseBlogPageStyles(this TinyMceSettings settings)
	{
		return settings
			.DisableMenubar()
			.AddEpiserverSupport()
			.AddPlugin("help image fullscreen lists media wordcount anchor table code searchreplace")
			.Toolbar("table | removeformat | blocks | epi-link anchor image epi-image-editor media epi-personalized-content | epi-dnd-processor | cut copy paste pastetext | fullscreen code | bold italic | bullist numlist | styles | fontfamily | undo redo superscript subscript hr | searchreplace underline indent alignleft aligncenter alignright alignjustify")
			.AddSetting("extended_valid_elements", "script[language|type|src]")
			.BlockFormats("Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4;Heading 5=h5;Heading 6=h6;Blockquote=blockquote;Preformatted=pre;")
			.StyleFormats(
			new
			{
				title = "Button Styles",
				items = new[]
				{
					new { title = "Primary Button", selector = "a", classes = "btn btn-primary" },
					new { title = "Secondary Button", selector = "a", classes = "btn btn-secondary" }
				}
			},
			new
			{
				title = "Blockquote Styles",
				items = new[]
				{
					new { title = "Blockquote Left", selector = "blockquote", classes = "left" },
					new { title = "Blockquote Right", selector = "blockquote", classes = "right" }
				}
			},
			new
			{
				title = "Content Styles",
				items = new[]
				{
					new { title = "Lead", selector = "p", classes = "lead" },
					new { title = "Content Left", selector = "p", classes = "float-left" },
					new { title = "Content Right", selector = "p", classes = "float-right" }
				}
			})
			.AddSiteCss("/assets/hnhn/tinymce/editor.css")
			.Height(600)
			.Width(628)
			.Resize(TinyMceResize.Both);
	}
}

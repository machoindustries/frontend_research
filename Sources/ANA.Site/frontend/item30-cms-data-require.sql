-- Item 30: settle whether 23 unmounted view modules are live via CMS-authored markup.
-- Run against the ANA CMS database (Optimizely CMS 12). Read-only.

-- Query A -- the direct answer: how many content properties mount each view?
WITH Candidates(ViewName) AS (
    SELECT * FROM (VALUES
        ('breadcrumb-view'),                      ('carousel-view'),
        ('cart-login-status-view'),               ('clear-form-view'),
        ('contact-search-view'),                  ('cookie-message-view'),
        ('cta-block-view'),                       ('cta-download-view'),
        ('episerver-forms-view'),                 ('gallery-view'),
        ('order-history-item-view'),              ('page-section-nav-view'),
        ('primary-hero-view'),                    ('product-detail-carousel-view'),
        ('product-request-more-information-view'),('quick-info-view'),
        ('resource-library-view'),                ('statement-product-view'),
        ('sticky-nav-view'),                      ('tabs-view'),
        ('test-view'),                            ('timeline-view'),
        ('view-more-view')
    ) AS v(ViewName)
)
SELECT  c.ViewName,
        COUNT(cp.pkID)                AS Occurrences,
        COUNT(DISTINCT cp.fkContentID) AS DistinctContentItems
FROM        Candidates c
LEFT JOIN   tblContentProperty cp
        ON  cp.LongString LIKE '%/src/views/' + c.ViewName + '%'
GROUP BY    c.ViewName
ORDER BY    Occurrences DESC, c.ViewName;

-- Query B -- where they live, for anything Query A reports > 0.
SELECT TOP 200
        pd.Name         AS PropertyName,
        ct.Name         AS ContentTypeName,
        cl.Name         AS ContentName,
        cp.fkContentID  AS ContentId,
        LEFT(cp.LongString, 400) AS Excerpt
FROM        tblContentProperty cp
JOIN        tblPropertyDefinition pd ON pd.pkID = cp.fkPropertyDefinitionID
LEFT JOIN   tblContent  ct2 ON ct2.pkID = cp.fkContentID
LEFT JOIN   tblContentType ct ON ct.pkID = ct2.fkContentTypeID
LEFT JOIN   tblContentLanguage cl
        ON  cl.fkContentID = cp.fkContentID
       AND  cl.fkLanguageBranchID = cp.fkLanguageBranchID
WHERE       cp.LongString LIKE '%data-require%'
ORDER BY    pd.Name, cp.fkContentID;

-- Query C -- sanity check: total rows carrying data-require at all.
-- If this returns 0, the CMS authors none of it and all 23 are dead.
SELECT COUNT(*) AS RowsWithDataRequire
FROM   tblContentProperty
WHERE  LongString LIKE '%data-require%';

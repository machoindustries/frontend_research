$(document).ready(function () {
    const dropdownResults = document.getElementById('resultsPerPageSelect');
    const dropdownSort = document.getElementById('sortGlobalPage');

    dropdownResults.setAttribute('aria-label', 'Page Size');
    dropdownSort.setAttribute('aria-label', 'Sorty By');

    // Custom Blog Input Logic
    const facetLabels = document.querySelectorAll('.form-check-label');
    const facetGroup = document.querySelectorAll('.facet-group');
    const facetInput = document.querySelectorAll('.category-filter');

    // Define Blog Input
    facetLabels.forEach((label) => {
        let radio = label.previousElementSibling;
        if (label.textContent.includes("Blog")) {
            radio.classList.add('blog-input');
        }
    });
    const blogContentRadio = document.querySelector('.blog-input');

    // Define Blog Type Inputs
    facetGroup.forEach((group) => {
        if (group.textContent.includes("Blog Type")) {
            const blogInputs = group.querySelectorAll('.category-filter');
            blogInputs.forEach((inputs) => {
                inputs.classList.add('blog-filter');
            });
        }
    });

    const blogTypeRadio = document.querySelectorAll('.blog-filter');
    function disableCustomInput() {
        if (blogContentRadio) {
            blogTypeRadio.forEach((input) => {
                input.checked = false;
                input.disabled = true;
            });
        }
    }

    disableCustomInput();

    if (blogContentRadio) {
        facetInput.forEach((input) => {
            input.addEventListener('click', function () {
                if (blogContentRadio.checked) {
                    blogTypeRadio.forEach((input) => {
                        input.disabled = false;
                    });
                }
                else {
                    disableCustomInput();
                }
            });
        });
    }

    function searchButton(pageNumber, categoryKey) {
        const actionUrl = $('#searchActionUrl').val();
        const query = $('#searchField').val();
        const pageSize = $('#resultsPerPageSelect').val() || 10;
        const sortBy = $('.sort-by').val();
        let startDate = $('#startDate').val();
        let endDate = $('#endDate').val();
        var selectedCategories = $(".category-filter:checked").map(function () {
            return $(this).val();
        }).get();
        var dateRangeFilter = $("#dateRangeFilter:checked").val();
        var selectedTimePeriod = $(".time-filter:checked").val();
        $("#noResultsMessage").hide();
        $('#loader').show();

        let data = {
            q: query,
            ps: pageSize,
            o: sortBy,
            tf: selectedTimePeriod ?? dateRangeFilter,
            p: pageNumber,
            IsAjax: true
        };
        if (categoryKey) {
            $(`.category-filter[value='${categoryKey}']`).prop('checked', true);
            if (!selectedCategories.includes(categoryKey)) {
                selectedCategories.push(categoryKey);
            }
        }
        if (selectedCategories.length > 0) {
            selectedCategories.forEach((category, index) => {
                data[`f[${index}]`] = category;
            });
        }

        if (startDate && endDate) {
            data.from = startDate;
            data.to = endDate;
        }

        let urlParams = { ...data };
        delete urlParams.IsAjax;
        const queryString = $.param(urlParams);
        const fullUrl = `${actionUrl}?${queryString}`;
        window.history.pushState(null, '', fullUrl);
        $.ajax({
            url: actionUrl,
            type: 'GET',
            data,
            success (response) {
                $('#showingFrom').text(response.showingFrom);
                $('#showingTo').text(response.showingTo);
                $('#totalResultsCount').text(response.totalHits);
                $('#ChallengetotalResultsCount').text(response.totalHits);
                $('#resultsPerPageSelect').val(response.pagination.pageSize);
                if (response.hits && response.hits.length > 0) {
                    var searchType = response.pageName;
                    switch (searchType) {
                        case 'Challenges':
                            updateChallengeResults(response.hits);
                            break;
                        case 'Blogs':
                            updateBlogResults(response.hits);
                            break;
                        case 'Search':
                            appendSearchResults(response);
                            break;
                        default:
                            console.log("Unknown search type.");
                    }

                    updatePagination(response.currentPage, response.pagination.totalPages);
                    $(".search__pagination").show();
                }
                else {
                    var listingsContainer = $('#challenge-listings');
                    var blogContainor = $('#blog-listings');
                    var searchContainor = $('#global-listings');
                    blogContainor.empty();
                    searchContainor.empty();
                    listingsContainer.empty();
                    $("#noResultsMessage").show();
                    $(".search__pagination").hide();
                }
            },

            error (xhr, status, error) {
                console.log('An error occurred:', error);
                $("#noResultsMessage").show();
                $(".search__pagination").hide();
            },
            complete () {
                $('#loader').hide();
            }
        });
    }
    function appendSearchResults(response) {
        var listingsContainer = $('#global-listings');
        listingsContainer.empty();

        if (response.hits && response.hits.length > 0) {
            response.hits.forEach(function (item) {
                var categoriesHtml = '';
                if (item.categories && Object.keys(item.categories).length) {
                    categoriesHtml = '<div class="search__category-list">';
                    Object.entries(item.categories).forEach(function ([key, value]) {
                        categoriesHtml += `<a href="" data-page-key=${key} aria-label="${value} Category">${value}</a>`;
                       
                    });
                    categoriesHtml += '</div>';
                }

                var itemHtml = `
                <div class="search__item search__item__global__Search">
                    <div class="card">
                        <div class="card-body p-0">
                            ${categoriesHtml}
                            <h4>${item.title}</h4>
                            <p>${item.excerpt}</p>
                            <div>${item.publishedDate}</div>
                            <a class="absolute-link" href="${item.url}" aria-label="Search Result Link"></a>
                        </div>
                    </div>
                </div>`;

                listingsContainer.append(itemHtml);
            });
        } else {
            $("#noResultsMessage").show();
        }
    }


    function updatePagination(currentPage, totalPages) {
        if (totalPages && currentPage) {
            var paginationHtml = '';
            paginationHtml += `<input type="hidden" id="totalPages" name="name" value="${totalPages}" />
                               <input type="hidden" id="currentPage" name="name" value="${currentPage}" />`;
            paginationHtml += `<li class="page-item ${currentPage == 1 ? "disabled" : ""}"><a class="page-link First" href="#" aria-label="First">
                                 <svg width="19" height="17" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                   <path d="M8.44616 1L1 8.44616L8.44616 15.8923" stroke="${currentPage == totalPages ? "D1D1D1" : "016D9E"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                   <path d="M17.6874 1.00011L10.2412 8.44627L17.6874 15.8924" stroke="${currentPage == totalPages ? "D1D1D1" : "016D9E"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                 </svg>
                              </a></li>`;

            paginationHtml += `<li class="page-item"><a class="page-link prevPage" href="#" aria-label="Previous">
                                <svg width="9" height="17" viewBox="0 0 9 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 1L1 8.5L8 16" stroke="${currentPage == totalPages ? "D1D1D1" : "016D9E"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </a></li>`;
            if (totalPages > 5) {
                if (currentPage > 3) {
                    paginationHtml += `<li class="page-item"><a class="page-link" href="#">1</a></li>`;
                    paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
                for (var i = Math.max(1, currentPage - 2); i <= Math.min(currentPage + 2, totalPages); i++) {
                    paginationHtml += `<li class="page-item page-item-count ${currentPage === i ? 'active' : ''}"><a class="page-link" href="#">${i}</a></li>`;
                }
                if (currentPage < totalPages - 2) {
                    paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                    paginationHtml += `<li class="page-item"><a class="page-link" href="#">${totalPages}</a></li>`;
                }
            } else {
                for (var i = 1; i <= totalPages; i++) {
                    paginationHtml += `<li class="page-item ${currentPage === i ? 'active' : ''}"><a class="page-link" href="#">${i}</a></li>`;
                }
            }
            paginationHtml += `<li class="page-item" ${currentPage == totalPages ? "disabled" : ""}><a class="page-link Next nextPage" href="#" aria-label="Next">
                                <svg width="9" height="17" viewBox="0 0 9 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 1L1 8.5L8 16" ${currentPage == totalPages ? "D1D1D1" : "016D9E"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </a></li>`;

            paginationHtml += `<li class="page-item" ${currentPage == totalPages ? "disabled" : ""}><a class="page-link Next Last" href="#" aria-label="Last">
                                <svg width="19" height="17" viewBox="0 0 19 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.44616 1L1 8.44616L8.44616 15.8923" ${currentPage == totalPages ? "D1D1D1" : "016D9E"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                    <path d="M17.6874 1.00011L10.2412 8.44627L17.6874 15.8924" ${currentPage == totalPages ? "D1D1D1" : "016D9E"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </a></li>`;
            $('.search__pagination .pagination').html(paginationHtml);
            $('#currentPage').val(currentPage);
            updatePaginationState(currentPage, totalPages);
        }
    }


    function updateChallengeResults(hits) {
        var listingsContainer = $('#challenge-listings');
        listingsContainer.empty();

        if (hits.length === 0) {
            $("#noResultsMessage").show();
            return;
        }
        hits.forEach(function (hit) {
            var itemHtml = `
            <div class="col-lg-4 search__item search__item--challenges" data-page-url="${hit.url}">
                <div class="card">
                    ${hit.imageUrl ? `<img src="${hit.imageUrl}" />` : '<div class="img-placeholder"></div>'}
                    <div class="card-body d-flex flex-column flex-grow-1 p-0">
                        ${hit.category ? `<div class="search__category-list"><a href="" data-page-key="${hit.category.key}" aria-label="${hit.category.value} Category">${hit.category.value}</a></div>` : ''}
                        <h4 class="search__item-title">${hit.title}</h4>
                        <div class="mt-auto">
                            ${hit.startDate ? hit.startDate : ''}
                        </div>
                    </div>
                    <a class="absolute-link" href="${hit.url}" role="button" aria-label="${hit.title} Link" tabindex="0"></a>
                </div>
            </div>`;
            listingsContainer.append(itemHtml);
        });
    }
    function updateBlogResults(hits) {
        var listingsContainer = $('#blog-listings');

        listingsContainer.empty();

        if (hits.length === 0) {
            $("#noResultsMessage").show();
            return;
        }

        hits.forEach(function (hit) {
            var itemHtml = `
            <div class="col-lg-4 search__item search__item--blogs">
                <div class="card">
                  ${hit.imageUrl ? `<img src="${hit.imageUrl}" />` : '<div class="img-placeholder search__item--click"></div>'}
                    <div class="card-body d-flex flex-column flex-grow-1 p-0">
                        ${hit.category ? `<div class="search__category-list"><a href="" data-page-key="${hit.category.key}" aria-label="${hit.category.value} Category">${hit.category.value}</a></div>` : ''}
                    <h4 class="search__item-title">${hit.title}</h4>
                    <a class="absolute-link" href="${hit.url}" role="button" aria-label="${hit.title} Link" tabindex="0"></a>
                </div>
            </div>
            </div>`;
            listingsContainer.append(itemHtml);
        });
    }
    function updatePaginationState(currentPage, totalPages) {
        $('.page-link.First, .page-link.prevPage').css('stroke', currentPage === 1 ? '#D1D1D1' : '#016D9E');
        $('.page-link.prevPage').parent().toggleClass('disabled', currentPage === 1);
        $('.page-link.Next, .page-link.Last').css('stroke', currentPage === totalPages ? '#D1D1D1' : '#016D9E');
        $('.page-link.nextPage').parent().toggleClass('disabled', currentPage === totalPages);
        $('.page-link.Last').parent().toggleClass('disabled', currentPage === totalPages);
    }


    $(document).on('click', '.page-item a', function (e) {
        e.preventDefault();

        const totalPages = parseInt($("#totalPages").val(), 10);
        const currentPage = parseInt($("#currentPage").val(), 10);

        let pageNumber;
        if ($(this).hasClass("prevPage")) {
            pageNumber = currentPage > 1 ? currentPage - 1 : 1;
        } else if ($(this).hasClass("nextPage")) {
            pageNumber = currentPage < totalPages ? currentPage + 1 : totalPages;
        } else if ($(this).closest('.page-item').find('.First').length) {
            pageNumber = 1;
        } else if ($(this).closest('.page-item').find('.Last').length) {
            pageNumber = totalPages;
        } else {
            pageNumber = parseInt($(this).text(), 10);
        }

        searchButton(pageNumber);
    });

    $("#searchButtonSearchPage").click(function () {
        searchButton(1);
    });

    $(document).on('click', '.search__category-list a', function (e) {
        e.preventDefault();
        var key = $(this).data('page-key');
        searchButton(1, key);
    });

    $("#searchField").on('keypress', function (e) {
        if (e.which == 13) {
            searchButton(1);
        }
    });

    $(document).on('change', '.category-filter, #resultsPerPageSelect, #sortGlobalPage', function () {
        searchButton(1);
    });

    $(document).on('change', '.time-filter', function () {
        $('#startDate').val('');
        $('#endDate').val('');
        $("#dateRangePicker").hide();
        searchButton(1);
    });

    $(document).on('click', '#clearAll', function () {

        $('.category-filter, .time-filter, #dateRangeFilter').prop('checked', false);
        $('#startDate, #endDate').val('');
        $('#resultsPerPageSelect').val($('#resultsPerPageSelect option:first').val());
        $("#dateRangePicker").hide();
        searchButton(1);
        disableCustomInput();
    });

    $(document).on('click', '.search__item--click', function () {
        var pageUrl = $(this).data('page-url');

        if (pageUrl) {
            window.location.href = pageUrl;
        }
    });

    $(document).on('change', '#dateRangeFilter', function () {
        $("#dateRangePicker").toggle($(this).is(':checked'));
    });
    function attachDateHandlers() {
        $('#startDate').change(function () {
            var startDate = $(this).val();
            $('#endDate').attr('min', startDate);
        });

        $('#endDate').change(function () {
            if (validateDates()) {
                searchButton(1);
            }
        });
    }
    attachDateHandlers();
});

function toggleBtn() {
    $('.search__btn-filter, .search__filters-close').on('click', function () {
        $('.search__btn-filter').toggleClass('d-none');
        $('body').toggleClass('no-scroll');
        $('.search__filters').toggleClass('show');
    });
}
$(".pagination, .form-check-input").click(function () {
    const yOffset = -200;
    const searchBar = document.querySelector('.search__search-box');
    const y = searchBar.getBoundingClientRect().top + window.scrollY + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
});

function validateDates() {
    const startDate = $('#startDate').val();
    const endDate = $('#endDate').val();
    const dateError = $('#dateError');

    const isInvalid = startDate && endDate && new Date(endDate) <= new Date(startDate);
    dateError.toggle(isInvalid);

    return !isInvalid;
}

toggleBtn();
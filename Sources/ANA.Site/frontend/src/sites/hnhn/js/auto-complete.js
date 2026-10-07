$(document).ready(function () {
    const actionUrl = $('#autoSearchActionUrl').val();
    $(document).on('click', '#searchButton', function (event) {
        var query = $('#searchBox').val().trim();
        if (query.length >= 2) {
            window.location.href = `${actionUrl }?q=${ encodeURIComponent(query)}`;
        }
    });
    $('#searchBox').on('keypress', function (e) {
        if (e.which == 13) {
            var query = $('#searchBox').val().trim();
            if (query.length >= 2) {
                window.location.href = `${actionUrl }?q=${ encodeURIComponent(query)}`;
            }
        }
    });
    function fetchSuggestions() {
        var query = $('#searchBox').val().trim();

        if (query.length >= 2) {
            $.ajax({
                url: `/api/search/suggestions/${ encodeURIComponent(query)}`,
                method: 'GET',
                success (data) {
                    if (data && data.length > 0) {
                        var suggestionBox = $('#suggestionBox');
                        suggestionBox.empty();

                        data.forEach(function (suggestion) {
                            var listItem = $('<li tabindex="0"></li>').text(suggestion);
                            listItem.on('click', function () {
                                $('#searchBox').val(suggestion);
                                suggestionBox.hide();
                                window.location.href = `${actionUrl }?q=${ encodeURIComponent(suggestion)}`;
                            });
                            listItem.on('keypress', function (e) {
                                if (e.which == 13) {
                                    $('#searchBox').val(suggestion);
                                    suggestionBox.hide();
                                    window.location.href = `${actionUrl }?q=${ encodeURIComponent(suggestion)}`;
                                }
                            });
                            suggestionBox.append(listItem);
                        });

                        suggestionBox.show();
                    } else {
                        $('#suggestionBox').hide();
                    }
                },
                error (xhr) {
                    console.error('Error fetching search suggestions:', xhr.responseText);
                }
            });
        } else {
            $('#suggestionBox').hide();
        }
    };
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#searchBox').length) {
            $('#suggestionBox').hide();
        }
    });

    $('#searchBox').on('input', function () {
        fetchSuggestions();
    });

    $('#searchBox').on('click', function () {
        fetchSuggestions();
    });
});
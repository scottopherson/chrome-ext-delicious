// Copyright 2013 Zach Manring

// UPDATE
// https://api.delicious.com/v1/posts/update — Check to see when a user last posted an item

// POSTS
// https://api.delicious.com/v1/posts/add? — add a new bookmark
// https://api.delicious.com/v1/posts/delete? — delete an existing bookmark
// https://api.delicious.com/v1/posts/get? — get bookmark for a single date, or fetch specific items
// https://api.delicious.com/v1/posts/recent? — fetch recent bookmarks
// https://api.delicious.com/v1/posts/dates? — list dates on which bookmarks were posted
// https://api.delicious.com/v1/posts/all? — fetch all bookmarks by date or index range
// https://api.delicious.com/v1/posts/all?hashes — fetch a change detection manifest of all items
// https://api.delicious.com/v1/posts/suggest — fetch popular, recommended and network tags for a specific url

// TAGS
// https://api.delicious.com/v1/tags/get — fetch all tags
// https://api.delicious.com/v1/tags/delete? — delete a tag from all posts
// https://api.delicious.com/v1/tags/rename? — rename a tag on all posts

// TAG BUNDLES
// https://api.delicious.com/v1/tags/bundles/all? — fetch tag bundles
// https://api.delicious.com/v1/tags/bundles/set? — assign a set of tags to a

//Globals
DELICIOUS = {};
DELICIOUS.runtime = {};

// custom css expression for a case-insensitive contains()
jQuery.expr[':'].Contains = function(a,i,m){
    return (a.textContent || a.innerText || "").toUpperCase().indexOf(m[3].toUpperCase())>=0;
};

//Functions
DELICIOUS.addLink = function() {

  chrome.tabs.getSelected(null, function(tab) {

    var options = {
      url: 'https://api.del.icio.us/v1/posts/add',
      data: {
        url: tab.url,
        description: $('#description').val(),
        shared: (localStorage.getItem('chrome-ext-delicious-private') === 'true') ? 'no' : 'yes',
        tags: $('section#addToDelicious #tag').val()
      },
      hash: localStorage.getItem('chrome-ext-delicious')
    };

    DELICIOUS.api(options, function(data) {

      var result = $(data).find('result').attr('code');

      $('p.log span').html(result);
      $('p.log').show();
      $('header > div').slideDown().delay(3000).slideUp();

      $('button.addLink').attr('disabled', 'disabled');
      $('button.viewLinks').trigger('click');

    });

  });
};

DELICIOUS.api = function(options, callbackSuccess, callbackFailure) {

  $.ajax({
    type: options.type || 'POST',
    url: options.url,
    data: options.data || {},
    headers: { 'Authorization' : 'Basic ' + options.hash},
    success: function(data) {
      if (typeof callbackSuccess === 'function') {
        callbackSuccess(data);
      }
    },
    error: function(xhr, type){
      if (typeof callbackFailure === 'function') {
        callbackFailure(xhr, type);
      }
    }

  });
};

DELICIOUS.authenticate = function(username, password) {

  if(username !== '' && password !== '') {
    var hash = btoa(username + ":" + password);

    var options = {
      type: 'GET',
      url: 'https://api.del.icio.us/v1/posts/update',
      hash: hash
    };

    DELICIOUS.api(options, function(data) {
      //TODO: Cleanup
      localStorage.setItem('chrome-ext-delicious', hash);
      $('p.error').html('').hide();
      $('section#login img.loading').hide();
      $('section#login').hide();
      $('section#content').show();

      DELICIOUS.doesTagExist();

    }, function() {
      $('p.error').html('Incorrect username or password.').show();
      $('header > div').slideDown().delay(7000).slideUp();
      $('section#login img.loading').hide();
      $("section#login button").removeAttr('disabled');

    });

  } else {
    $('p.error').html('Please provide a username and password').show();
    $('header > div').slideDown().delay(7000).slideUp();
    $('section#login img.loading').hide();
    $("section#login button").removeAttr('disabled');
  }
};

DELICIOUS.getCurrentTabUrlAndUpdateValue = function() {
  chrome.tabs.getSelected(null, function(tab) {
    $('section#addToDelicious #description').val(tab.title);
    DELICIOUS.getSuggestedTags();
  });
};

DELICIOUS.doesTagExist = function() {

  chrome.tabs.getSelected(null, function(tab) {

    var options = {
      url: 'https://api.del.icio.us/v1/posts/get',
      data: {
        url: tab.url
      },
      hash: localStorage.getItem('chrome-ext-delicious')
    };

    DELICIOUS.api(options, function(data) {
      var json = xml.xmlToJSON(data);

      if (typeof json.posts === 'object') {
        $('p.log span').html('Item already exists');
        $('p.log').show();
        $('header > div').delay(500).slideDown().delay(7000).slideUp();

        $('button.addLink').attr('disabled', 'disabled');
        $('button.viewLinks').trigger('click');

      } else {

        DELICIOUS.getCurrentTabUrlAndUpdateValue();
        DELICIOUS.getAllMyTags();

      }

    });

  });
};

DELICIOUS.getListOfLinks = function() {

  var options = {
    type: 'GET',
    url: 'https://api.del.icio.us/v1/posts/all?',
    hash: localStorage.getItem('chrome-ext-delicious')
  };

  DELICIOUS.api(options, function(data) {
    var json = xml.xmlToJSON(data);
    var html = '';

    $.each(json, function(index, obj) {
      $('section#viewMyLinks > header > h1').html(obj['@user'] + ' <span>(' + obj['@total'] + ')</span>');

      $.each(obj.post, function(index, obj) {

        var tags = obj['@tag'].split(' ');

        html += '<li>';
        html += '<a class="link" href="' + obj['@href'] + '" target="_blank">' + obj['@description'] + '</a>';
        html += '<p class="tag">';

        for (var i = 0; i < tags.length; i++) {
          if (tags[i] !== '') {
            html += '<a class="link_tag" href="javascript:void(0)">' + tags[i] + '</a>';
          }
        }

        html += '</p>';
        html += '<a title="Delete this bookmark" class="delete" href="https://api.del.icio.us/v1/posts/delete?md5=' + obj['@hash'] + '">x</a>';
        html += '<div class="confirm">';
        html += '<button>Delete?</buton>';
        html += '</div>';
        html += '</li>';

      });

    });

    $('section#viewMyLinks ul.links').html(html);

    DELICIOUS.listFilter($("#search"), $("ul.links"));

  });
};

DELICIOUS.getAllMyTags = function() {

  var options = {
    type: 'GET',
    url: 'https://api.del.icio.us/v1/tags/get',
    hash: localStorage.getItem('chrome-ext-delicious')
  };

  DELICIOUS.api(options, function(data) {

    function split( val ) {
      return val.split( /,\s*/ );
    }

    function extractLast( term ) {
      return split( term ).pop();
    }

    var json = xml.xmlToJSON(data);

    var list = [];

    $(json.tags.tag).each(function(index, obj) {
      list.push(obj['@tag']);
    });

    $("#tag").autocomplete({
      autoFocus: true,
      source: function( request, response ) {
        response( $.ui.autocomplete.filter(
          list, extractLast( request.term ) ) );
      },
      focus: function() {
        return false;
      },
      select: function( event, ui ) {
        var terms = split( this.value );
        terms.pop();
        terms.push( ui.item.value );
        terms.push( "" );
        this.value = terms.join( ", " );
        return false;
      }

    });

  });
};

DELICIOUS.getSuggestedTags = function() {

  chrome.tabs.getSelected(null, function(tab) {

    var options = {
      type: 'GET',
      url: 'https://api.del.icio.us/v1/posts/suggest?url=' + tab.url,
      hash: localStorage.getItem('chrome-ext-delicious')
    };

    DELICIOUS.api(options, function(data) {

      var json = xml.xmlToJSON(data);

      if (json.suggest !== undefined) {
        var popularTags = [];

        $.each(json.suggest.popular, function(index, obj) {
          popularTags.push(obj['@tag']);
        });

        if (popularTags.length > 0) {
          $('section#addToDelicious > span.tags').html('Popular: <a class="tag" href="#">' + popularTags.join('</a> <a class="tag" href="#">') + '</a>');
        }

      } else {

        $('section#addToDelicious > span.tags').html('');

      }

    });

  });
};

DELICIOUS.init = function() {

  DELICIOUS.processLocalStorage();
  if (localStorage.getItem('chrome-ext-delicious') !== null) {

    DELICIOUS.doesTagExist();

  }
};

DELICIOUS.listFilter = function(header, list) {

  var input = $("<input>").attr({"class":"filterinput","type":"search","placeholder":"search","results":""});
  $(header).append(input);

  $(input).on('change',  function () {
    var filter = $(this).val();
    if(filter) {
      $(list).find("a.link:not(:Contains(" + filter + "))").parent().hide();
      $(list).find("a.link:Contains(" + filter + ")").parent().show();
      $(list).find("p.tag:Contains(" + filter + ")").parent().show();
    } else {
      $(list).find("li").slideDown();
    }

    //count
    $('section#viewMyLinks > header > h1 span').html('(' + $('ul.links li:not(:hidden)').length + ')');

    return false;
  });

  $(input).on('keyup',  function () {
    $(input).trigger('change');
  });

  $('nav ul li#search input').show().focus();

};

DELICIOUS.processLocalStorage = function() {

  // isPrivate?
  if (localStorage.getItem('chrome-ext-delicious-private') === 'true') {
    $('input#private').prop('checked', true);
  }

  // isHashAvailable?
  if(localStorage.getItem('chrome-ext-delicious')) {

    $('section#addToDelicious button').on('click', function() {
      $(this).attr("disabled", "disabled");
      $('section#addToDelicious img.loading').show();

      DELICIOUS.addLink();

    });

  } else {

    $('section#content').hide();
    $('section#login').show();

    $("section#login button").on('click', function() {
      $(this).attr("disabled", "disabled");
      $('section#login img.loading').show();

      DELICIOUS.authenticate($("#username").val(), $("#password").val());

    });

  }
};


$(function() {

  DELICIOUS.init();

  //Events
  $('input#private').on('change', function() {
    if ($(this).is(':checked')) {
      localStorage.setItem('chrome-ext-delicious-private', 'true');
    } else {
      localStorage.setItem('chrome-ext-delicious-private', 'false');
    }
  });

  $('button.close').on('click', function() {
    $(this).parent().hide();
  });

  $('section#content > nav button').on('click', function() {
    $('section#content > nav button').each(function() {
      $(this).removeClass('selected');
      $('#' + $(this).attr('name')).hide();
    });
    $(this).addClass('selected');
    $('#' + $(this).attr('name')).show();
  });

  $('section#content > nav button.viewLinks').on('click', function() {

    $('#addToDelicious > span > button').attr('disabled', 'disabled');

    if (DELICIOUS.runtime.getListOfLinks === undefined) {
      DELICIOUS.getListOfLinks();
      DELICIOUS.runtime.getListOfLinks = true;
    }

    $('nav ul li#search input').show().focus();


  });

  $('section#content > nav button.addLink').on('click', function() {
    $('#addToDelicious > span > button').removeAttr('disabled');
    $('nav ul li#search input').hide();
  });

  $('section#viewMyLinks').on('click', 'a.delete', function(e) {
    e.preventDefault();

    DELICIOUS.runtime.deleteUrl = $(this).attr('href');
    $(this).siblings('div.confirm').show();

  });

  $('section#viewMyLinks').on('click', 'div.confirm button', function() {

    var me = $(this);
    var options = {
      type: 'GET',
      url: DELICIOUS.runtime.deleteUrl,
      hash: localStorage.getItem('chrome-ext-delicious')
    };

    DELICIOUS.api(options, function() {
      me.parents('li').fadeOut('slow', function() {
        $(this).remove();
      });
    });
  });

  $('section#viewMyLinks').on('click', 'div.confirm', function() {
    $(this).hide();
  });

  $('section#addToDelicious').on('click', 'a.tag', function() {
    $('#tag').val($('#tag').val() + $(this).html() + ', ');
    $(this).remove();
    $('#tag').focus();
  });

  $("section#login, section#addToDelicious").keypress(function (e) {
    if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
      $('section > span > button').trigger('click');
      return false;
    }
  });

  $('section#viewMyLinks').on('click', '.link_tag', function() {
    $('input.filterinput').val($(this).html()).trigger('change');
  });

});


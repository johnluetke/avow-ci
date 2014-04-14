define([
  'jquery'
], function ($) {

  var dom = {

    $app: $('#app'),

    renderView: function (view) {
      var $vC = $('#viewContainer');
      $vC.html(view);
    },

    notification: function (type, message) {
      var $notification = $('#notification');
      $notification.addClass(type).find('span').html(message);
      setTimeout(function () {
        $notification.removeClass(type);
      }, 3000);
    },

    startBuildSpinner: function (project) {
      $('.build-spinner[data-project="' + project + '"] i').addClass('fa-spin');
    },

    appendBuildLog: function (data) {
      var log = $('.build-log');
      log
        .append(data + '\n')
        .scrollTop(log.prop('scrollHeight'));
    },

    setSessionClass: function (status) {
      if (status===0) {
        $('header').removeClass('active-session');
        $('body').addClass('login');
      } else {
        $('header').addClass('active-session');
        $('body').removeClass('login');
      }
    }

  };

  return dom;

});

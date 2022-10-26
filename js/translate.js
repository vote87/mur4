/// <reference path="./Encoder.js" />
//Dev

$(document).ready(function () {
    var selector = '#ddlLanguage';
    $(selector).on('change', function (e) {
        // Language = $(this).val();
        e.preventDefault();
        startLang($(this));

        //language name
        var names = [];
        $('#ddlLanguage option').each(function (index, element) {
            var text;
            GetValueByKey($(this).attr('data-text'), $('#ddlLanguage option:selected').val(), function (e) { text = e; });
            $(this).text(text);
        });
    });
    var startLang = function (el) {
        var el = $(el).find('option:selected');
        var text = el.attr('data-text');
        var file = el.attr('data-file');
        // file = file.split(',');
        // text = text.split(',');
        // var index = el.attr('data-index');
        // if (index >= file.length) {
        //     index = 0;
        // }
        // changeName(el, text[index]);
        // changeIndex(el, index);
        // $('html').attr('lang', file);
        if (file != '' && file != undefined) {
            loadLang(file);
        }
    };

    var changeName = function (el, name) {
        $(el).html(name);
    };

    var changeIndex = function (el, index) {
        $(el).attr('data-index', ++index);
    };

});

function loadLang(lang) {
    Encoder.EncodeType = 'entity';
    lang = lang.toLowerCase();
    var processLang = function (data) {
        var arr = data.split('\n');
        for (var i in arr) {
            if (lineValid(arr[i])) {
                var obj = arr[i].split('=>');
                assignText(obj[0], obj[1]);
            }
        }
    };
    var assignText = function (key, value) {
        $('[data-lang="' + key + '"]').each(function () {
            var attr = $(this).attr('data-destine');
            if (typeof attr !== 'undefined') {
                $(this).attr(attr, value);
            } else {
                //VALIDACION PARA QUE NO CAMBIE EL TEXTO CONFIGURADO PARALA SECCION DE ANALISTA Y SOLICITANTE
                if(key != "lblAnalystSection" && key !="lblRequestSection"){
                    $(this).empty().html(Encoder.htmlEncode(value));
                }else if(isNullOrWhitespace($('#hlblAnalystSection').val()) && key == "lblAnalystSection"){
                    $(this).empty().html(Encoder.htmlEncode(value));
                }else if(isNullOrWhitespace($('#hlblRequestSection').val()) && key == "lblRequestSection"){
                    $(this).empty().html(Encoder.htmlEncode(value));
                }
            }
        });
    };
    var lineValid = function (line) {
        return (line.trim().length > 0);
    };
    $('.loading-lang').addClass('show');

    var endpoint = `${urlLang.endsWith('/') ? urlLang : urlLang + '/'}${lang}.txt`;
    $.ajax({
        async: false,
        // url: _spPageContextInfo.webServerRelativeUrl + '/UR2/lang/' + lang + '.txt', //_spPageContextInfo.webServerRelativeUrl
        // url: url + '/MUR4/Page/lang/' + lang + '.txt', //_spPageContextInfo.webServerRelativeUrl
        dataType: "text",
        url: endpoint,
        error: function () {
            alert('No se cargó traducción');
        },
        success: function (data) {
            $('.loading-lang').removeClass('show');
            processLang(data);
        }
    });
}

function GetValueByKey(key, lang, callback) {

    var lineValid = function (line) {
        return (line.trim().length > 0);
    };

    if (lang == '' || lang == undefined) lang = 'en';
    var endpoint = `${urlLang.endsWith('/') ? urlLang : urlLang + '/'}${lang}.txt`;

    $.ajax({
        async: false,
        // url: _spPageContextInfo.webServerRelativeUrl + '/UR2/lang/' + lang.toLowerCase() + '.txt', //_spPageContextInfo.webServerRelativeUrl
        // url: url + '/MUR4/Page/lang/' + lang + '.txt', //_spPageContextInfo.webServerRelativeUrl
        url: endpoint, 
        error: function () {
            alert('Error loading translate');
        },
        success: function (data) {
            // $('.loading-lang').removeClass('show');
            var arr = data.split('\n');
            let keyNotFound = true;
            for (var i in arr) {
                if (lineValid(arr[i])) {
                    var obj = arr[i].split('=>');
                    if (obj[0] == key) {
                        callback(obj[1]);
                        keyNotFound = false;
                    }
                }
            }

            if(keyNotFound) {
                let response;
                GetDefaultTextByKey(key, lang, (v) => response = v);
                callback(response); 
            }
        }
    });

}


function GetDefaultTextByKey(key, lang, callback) {
    
    var lineValid = function (line) {
        return (line.trim().length > 0);
    };

    if (lang == '' || lang == undefined) lang = 'en';
    var endpoint = `https://azureford.sharepoint.com/sites/MUR4master/source/lang/${lang}.txt`;

    $.ajax({
        async: false,
        url: endpoint, 
        error: function () {
            alert('Error loading translate');
        },
        success: function (data) {
            var arr = data.split('\n');
            let keyNotFound = true;
            for (var i in arr) {
                if (lineValid(arr[i])) {
                    var obj = arr[i].split('=>');
                    if (obj[0].trim() == key.trim()) {
                        callback(obj[1]);
                        keyNotFound = false;
                    }
                }
            }

            if(keyNotFound) callback('');
        }
    });
}

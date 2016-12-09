;(function($) {

    if(Cookies == undefined) throw 'include https://github.com/js-cookie/js-cookie';
    if(typeof gettext == 'undefined') throw 'activate JavaScriptCatalog translations in Django';

    Array.prototype.contains = function(val, key) {  // make something beautiful
        if(key){
            var found = false;
            this.forEach(function(el, i){
                if(el[key]==val){
                    found = true;
                }
            });
            return found;
        }else{
            return this.indexOf(val)>-1;
        }
    };

    function isInt(value) {
        return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === '[object Array]';
    }

    function isObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    // for jsonify
    $.fn.serializeObject = function() {
        var o = {};
        var a = this.serializeArray();
        $.each(a, function() {
            if (o[this.name]) {
                if (!o[this.name].push) {
                    o[this.name] = [o[this.name]];
                }
                if(this.value)
                    if(this.value){
                        var val = this.value;
                        if(isInt(val))
                            o[this.name].push(parseInt(this.value));
                        else
                            o[this.name] = this.value;
                    }
            } else {
                if(this.value){
                    var val = this.value;
                        if(isInt(val))
                            o[this.name] = parseInt(this.value);
                        else
                            o[this.name] = this.value;
                }
            }
        });
        return o;
    };

    $.fn.attrs = function() {
        if (arguments.length === 0) {
            if (this.length === 0) {
                return null;
            }

            var obj = {};
            $.each(this[0].attributes, function() {
                if (this.specified) {
                    obj[this.name] = this.value;
                }
            });
            return obj;
        }
    };


    $.formBuilder = function(el, options) {

        var defaults = {
            header: function() {
                return {
                    'X-CSRFToken': Cookies.get('csrftoken')
                }},
            onSuccess: function(form, response) {},
            success_message: 'Redirecting...',  // if specified and we dont get anything from the server
            onError: function(form, response) {},
            onInit: function(form) {},
            errorClass: 'error',  // on the field
            errorMessageClass: 'errorlist',  // if specified added as a div after the field

            // https://jsbin.com/wokeho/edit?html,output
            fileUploadHolderClass: '.uploader',
            fileTemplate: '<div class="uploader form-inline"><div class="form-group" template="file-name"></div><div class="form-group"><span template="upload-button"></span><span template="delete-button"></span></div><div class="progress"><div class="progress-bar" role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100" style="width: 0%;"><span class="sr-only">0%</span></div></div></div>',
            fileNameEnabled: false, // TODO handle file name in django file post, update ajax fields also
            fileTSF: '[template="file-name"]',
            fileName: '<input type="text" class="form-control" placeholder="File Name">',
            filePlaceholder: '<div class="form-control-static"></div>',
            fileBrowseMessage: 'Please choose a file...&nbsp;',
            fileTSD: '[template="delete-button"]',
            fileDelete: '<div class="btn btn-default glyphicon glyphicon-trash"></div>',
            fileTSU: '[template="upload-button"]',
            // fileUpload: '<label class="btn btn-default glyphicon glyphicon-upload"><input type="file" style="display: none;"></label>',
            fileUpload: '<label class="btn btn-default">Browse<input type="file" style="display: none;"></label>',
            fileProgressBar: true,
            addButtonTemplate: '<div class="add btn btn-primary"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> Add</div>'
        };
        var plugin = this;
        plugin.settings = {};
        plugin.files = [];

        var init = function() {
            plugin.settings = $.extend({}, defaults, options);
            console.log(plugin.settings);
            plugin.el = el;
            el.bind('submit', plugin.submit);
            initFields();
            initFileFields(plugin.el);
            plugin.settings.onInit(plugin.el);

        };

        plugin.submit = function(e){
            e.preventDefault();
            $.ajax({
                url: plugin.el.attr('action'),
                method: plugin.el.attr('method'),
                data: getData(),
                dataType: 'json',
                contentType: "application/x-www-form-urlencoded",
                headers: plugin.settings.header(),
                context: plugin.el,
                beforeSend:onBefore
            }).done(onSuccess)
            .fail(onFail)
            .always(onFinal);
        };

        plugin.validate = function() {
            // code goes here
            toast('validating');
        };

        var date_fields = [
            "DateField",
            "DateTimeField",
            "TimeField"
        ];
        var decimal_fields = [
            "IntegerField",
            "DecimalField"
        ];
        var char_fields = [
            "CharField",
            "EmailField",
            "URLField",
            "RegexField"
        ];

        var multiple_field_types = [].concat(char_fields, date_fields, decimal_fields);

        var multiple_upload_types = [
            "FileField",
            "ImageField"
        ];

        var single_fields = [
            "BooleanField",
            "ChoiceField"
        ];

        var special_field_types = [
            "MultipleChoiceField"
        ].concat(single_fields);


        var initFields = function(){
            var addButton = $(plugin.settings.addButtonTemplate);
            plugin.el.find('.formset').each(function(){
                var formset = $(this);
                var item = formset.find('fieldset').last().clone();
                var max = formset.find('[name*="MAX_NUM_FORMS"]').val();
                var _addButton = addButton.clone();
                formset.find('.sets').data({item:item, max:max}).after(_addButton);
                formset.find('[name*="DELETE"]').bind('change', function(){
                    deleteFS($(this));
                });
                _addButton.bind('click', function(){
                    addFS($(this));
                });
                plugin._addButton = _addButton;
            });
            plugin.el.find('.other-choice-button').bind('change', function(e){
                if ($(this).is(':checked') && $(this).hasClass('other-choice-trigger')) {
                    $(this).parents('ul').next().next().show();
                } else {
                    $(this).parents('ul').next().next().hide();
                }
            });
            plugin.el.find('.other-choice-trigger').each(function(){
                if ($(this).is(':checked')) {
                    $(this).parents('ul').next().next().show();
                }
            })
        };

        var initFileFields = function(form){
            form.find('input[type="file"]').each(function(){
                assignUploader($(this));
            });

        };

        var setPercent = function(el, val){
            el.attr('aria-valuenow', val).css({width: val+'%'})
                .children().eq(0).text(val+'%');

            if(val==100 || val==0){
                setTimeout(function(){
                    el.parent().hide();
                },1000);
            }
        };

        var assignUploader = function(el){
            var template = $(plugin.settings.fileTemplate);
            var fileName = $(plugin.settings.fileName);
            var filePlaceholder = $(plugin.settings.filePlaceholder);
            var fileDelete = $(plugin.settings.fileDelete);
            var fileUpload = $(plugin.settings.fileUpload);


            var _name = el.attr('name');
            var _id = el.attr('id');
            el.wrap(template);
            var holder = el.parents(plugin.settings.fileUploadHolderClass);
            holder.find('input[type="file"]').eq(0).remove(); // delete the initial upload field, to preserve template
            if(plugin.settings.fileNameEnabled){
                holder.find(plugin.settings.fileTSF).append(fileName);
            }else{
                holder.find(plugin.settings.fileTSF).append(filePlaceholder).children().eq(0).html(plugin.settings.fileBrowseMessage);
            }
            holder.find(plugin.settings.fileTSD).append(fileDelete).hide();
            var fileUpload = holder.find(plugin.settings.fileTSU).append(fileUpload).find('[type="file"]').attr({name:_name,id:_id});
            $(holder).find('.progress').hide();

            // file delete event
            fileDelete.bind('click',function(){
                var data = {
                    file_delete: $(this).attr('pk')
                };
                $.ajax({
                    url: plugin.el.attr('action'),
                    method: 'POST',
                    data: data,
                    dataType: 'json',
                    headers: plugin.settings.header(),
                    context: $(this),
                }).done(function(){
                    this.parent().hide();
                    var holder = this.parents(plugin.settings.fileUploadHolderClass);
                    holder.find(plugin.settings.fileTSF).children().eq(0).html(plugin.settings.fileBrowseMessage);
                    if(plugin.settings.fileProgressBar){
                        setPercent(holder.find('.progress-bar'),0);
                    }
                }).fail(onFail)
                .always(function(){

                });

            });

            fileUpload.fileupload({
                dataType: 'json',
                dropZone: el.parents(plugin.settings.fileUploadHolderClass),
                url: plugin.el.attr('action'),
                formData: {
                    'csrfmiddlewaretoken': Cookies.get('csrftoken')
                },
                change:function(e, data){
                    var filename = data.fileInput[0].value;
                    $(e.target).parents(plugin.settings.fileUploadHolderClass).find(plugin.settings.fileTSF).children().eq(0).html(filename);
                },
                progress:function(e, data){
                    var progressBar = $(e.target).parents(plugin.settings.fileUploadHolderClass).find('.progress-bar');
                    if(plugin.settings.fileProgressBar){
                        progressBar.parent().show();
                        var progress = parseInt(data.loaded / data.total * 100, 10);
                        setPercent(progressBar, progress);
                    }
                }
            }).bind('fileuploaddone', function(e, response){
                var response = response.jqXHR.responseJSON;
                var name = e.target.name;
                var field = $(e.target);
                field.parents(plugin.settings.fileUploadHolderClass).find(plugin.settings.fileTSD).show().children().eq(0).attr('pk',response.pk);
                var file_suffix = '_files';

                // name can be

                // form-ff
                // form3-0-ff
                var key = name.replace(/(\w+\-)(\d+\-\d+\-)?(.+)/g, '\$1\$2');

                if(key.match(/-\d+-\d+-/g)){
                    // formsets, we will populate form-[x]-[index]-files
                    // form-3-0-
                    var _field = key+file_suffix;
                }
                else{
                    // simple form, we will populate files
                    // form-
                    var _field = file_suffix;
                }
                if(!plugin.files.contains(_field, 'name')){
                    plugin.files.push({
                        name:_field,
                        value:[response.pk]
                    });
                }
                plugin.files.forEach(function(item, i){
                    if(item.name==_field && !item.value.contains(response.pk)){
                        item.value.push(response.pk);
                    }
                });
            })
        };

        var removeButton = $('<div class="remove btn btn-primary pull-right"><span class="glyphicon glyphicon-minus" aria-hidden="true"></span></div>');
        // var deleteButton = $('<div class="delete btn btn-primary pull-right"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span></div>');

        var deleteFS = function(el){
            // var holder = el.parents('.sets');
            // var lines = holder.children(':visible').length;
            // el.parents('fieldset').hide();
            // if(lines==1){
            //     addButton.trigger('click');
            // }
            // addButton.show();
            // processFS(holder);
        };

        var addFS = function(el){
            var holder = el.prev();
            var lines = holder.children(':visible').length;
            if(lines < holder.data('max')){
                var fs = holder.data('item').clone();
                var num = getTotalForms(holder);  // initial id = 0, we calculate by FS items, so we will always have one more no need to increment
                // process all the fields increment numbers
                $('*',fs).each(function(){
                    var elem = $(this);
                    $.map($(this).attrs(), function(val, key){
                        var regex = /-(\d+)-(\d+)-/g;
                        var match = regex.exec(val);
                        if(match){
                            // if attribute like -pk-num- replace the number to the next free
                            elem.attr(key, val.replace('-'+match[1]+'-'+match[2]+'-', '-'+match[1]+'-'+num+'-'));
                        }
                    })
                });
                fs.find('[name*="DELETE"]').bind('change', function(){
                    deleteFS($(this));
                });
                fs.find('[value]').not('[type="radio"]').val('');
                fs.find('[checked]').removeAttr('checked');
                holder.append(fs);
            }
            if(lines == holder.data('max')-1){
                plugin._addButton.hide();
            }
            setTotalForms(holder);
            initFileFields(fs);
        };

        var getTotalForms = function(holder){
            return parseInt(holder.parent().find('[name*="TOTAL_FORMS"]').val());
        };

        var setTotalForms = function(holder){
            holder.parent().find('[name*="TOTAL_FORMS"]').val(holder.children().length);
        };

        var getData = function() {
            var data = plugin.el.serialize();
            if(plugin.files.length){
                data = data + '&' + $.param(plugin.files);
            }
            return data;
            // return JSON.stringify(plugin.el.serializeObject());
        };

        var onBefore = function(xhr){
            clearErrors();
        };

        var onSuccess = function(response){
            plugin.settings.onSuccess(plugin.el, response);
            if(response.success_message){
                toast(response.success_message, 'success');
            }else{
                if(plugin.settings.success_message){
                    toast(plugin.settings.success_message, 'success');
                }
            }
            if(response.action.redirect && response.action.redirect_url){
                window.location = response.action.redirect_url;
            }
        };

        var onFail = function(response){
            plugin.settings.onError(plugin.el, response);
            if(response.status==500){
                toast('Server error 500','error');
            }else{
                if(response.responseJSON){
                    if(response.responseJSON.notify){
                        $.each(response.responseJSON.notify,function(i, notification){
                           toast(notification.message, notification.type);
                        });
                    }
                    processErrors(response.responseJSON.errors);
                }else{
                    toast('Request error', 'error');
                }
            }
        };

        var onFinal = function(){

        };


        var toast = function(message, type){
            if(type == 'warning'){
                toastr.warning(message);
            }else
            if(type == 'error'){
                toastr.error(message);
            }else
            if(type == 'success'){
                toastr.success(message);
            }else{
                toastr.info(message);
            }
        };

        var processErrors = function(errors){
            if(errors != undefined){
                $.map(errors, function(val,key) {
                    if(isObject(val)){
                        $.map(val,function(v, k){
                            showError(k, v.join());
                        })
                    }else{
                        showError(key, val.join());
                    }
                });
                // }
            }
        };

        var clearErrors = function(){
            plugin.el.find('.'+plugin.settings.errorMessageClass).hide().text('');
            plugin.el.find('.'+plugin.settings.errorClass).removeClass(plugin.settings.errorClass);
        };

        var showError = function(field_name, message){
            var fields = plugin.el.find('[name='+field_name+']');
            if(fields.length>1){
            // there are more fields with that same name
                if(fields.eq(0).attr('type')=='radio'){
                // the type of the first is 'radio'
                // show error after all the radio out of ul
                    var item = fields.eq(0);
                    if(plugin.settings.errorMessageClass){
                        if(!item.parents('ul').next().is('.'+plugin.settings.errorMessageClass)){
                            item.parents('ul').after('<div class="'+plugin.settings.errorMessageClass+'"></div>');
                        }
                        item.parents('ul').next('.'+plugin.settings.errorMessageClass).show().text(message);
                    }
                    fields.parent().addClass(plugin.settings.errorClass);
                }
            }else{
                // unique field
                // show error after the field
                var item = fields;
                if(item.attr('type')=='file'){
                    //if file input
                    var uploader = item.parents('.uploader');
                    if(plugin.settings.errorMessageClass){
                        if(!uploader.next().is('.'+plugin.settings.errorMessageClass)){
                            uploader.after('<div class="'+plugin.settings.errorMessageClass+'"></div>');
                        }
                        uploader.next('.'+plugin.settings.errorMessageClass).show().text(message);
                    }
                    uploader.find(plugin.settings.fileTSU+' .btn').addClass(plugin.settings.errorClass);
                }else{
                    if(plugin.settings.errorMessageClass){
                        if(!item.next().is('.'+plugin.settings.errorMessageClass)){
                            item.after('<div class="'+plugin.settings.errorMessageClass+'"></div>');
                        }
                        item.parent().find('.'+plugin.settings.errorMessageClass).show().text(message);
                    }
                    item.addClass(plugin.settings.errorClass);
                }
            }
        };

        init();

    }

})(jQuery);

/**
 * MUR4.js main file of all the functionality in Mobile Universal Request module.
 */

/**
 * @description This event occurs when the page loads all content
 */
$(function () {
    init();
});

/**
 * @description first function loaded when the page loads
 */
async function init() {

    $('.loading').show();
    userName = _spPageContextInfo.userLoginName;
    domain = DOMAIN365.replace(/#/g, '%23');

    try {

        const response = await GetMyProps();
        objUser = response.d;
        userLogin = objUser.Email.split('@')[0].toUpperCase();
        displayName = objUser.DisplayName;

        SiteCode = getUrlParameter('SiteCode');
        url = _spPageContextInfo.webServerRelativeUrl;

        SiteCode == null ? await listValues() : await listValues(`SiteCode eq '${SiteCode}'`);

        //TODO: REFACTOR
        if (!codeExists) {

            let options = '<option selected disabled hidden>Select...</option>';
            // gets the values from MUR4_SitesConfiguration list
            try {
                let path = `${url}/_api/web/lists/getbytitle('MUR4_SitesConfiguration')/items?`;
                const response = await fetch(path, {
                    headers: ACCEPT
                });
                const data = await response.json();

                for (let j = 0; j < data.d.results.length; j++) {
                    options += '<option value="' + data.d.results[j].SiteCode + '">' + data.d.results[j].Title + '</option>';
                }

                $('#slt_locations_default').html(options);

            } catch (e) {
                alert('Error al cargar configuración inicial');
                console.log(e);
            }

            $('#mdl_siteSelect').modal({
                backdrop: 'static',
                keyboard: false
            });

            $('#mdl_siteSelect').modal('show');
        }

        userName = domain + userName;
        events();
        await loadLanguages();
        await load();

    } catch (e) {
        alert(JSON.stringify(e));
        console.log(JSON.stringify(e));
    }
    ajax();
    $('.loading').hide();
}

function ajax() {

}
/**
 * this function contains all the UI events functions related to MUR4 proccesses
 */
function events() {
    //Event keypress to controls with those classes to get a blur event when press enter
    $(document).on('keypress', '.txtRequest, .txtApproval', function (e) {
        if (e.which == 13) {
            $(this).blur();
            e.preventDefault();
        }
    });

    //Event ajaxStart to show loading template
    $(document).ajaxStart(function () {
        $(".loading").css({ 'display': 'block' });
    });

    //Event ajaxStop to hide loading template
    $(document).ajaxStop(function () {
        $(".loading").css({ 'display': 'none' });
    });

    //#region DropDowns
    $('#ddBuilding').on('change', function () {
        ClearForm();
        ClearResponsible();
        ClearAnalysts();
        $('#ddArea').find('option').remove();
        $('#ddRequestType').find('option').remove();
        if ($(this).val() != "") {
            LoadServices($(this).val());
        }
    });

    $('#ddArea').on('change', async function () {
        ClearResponsible();
        ClearForm();
        ClearAnalysts();
        if ($(this).val() != "") {
            service = $(this).val();
            let filtro = `Building eq '${buildingCode}' and Title eq '${service}'`;
            const data = await GetListByQuery(url, LISTAITSERVICES, filtro, "");
            let subservices = Array.from(new Set(data.d.results.map(function (value) {
                if (value.Autorizaciones > 0) {
                    if (value != undefined && value != '') {
                        return value.SubServicio;
                    }
                }
            })));
            if (subservices.indexOf(undefined) > -1) {
                subservices.splice(subservices.indexOf(undefined), 1);
            }
            subservices = subservices.sort();
            FillDDL('ddRequestType', subservices);
            loadInputByParameter('ddRequestType', 'requestType');

            GetAdmins(buildingCode, service);

        } else {
            $('#ddRequestType').find('option').remove();
        }
    });

    $('#ddRequestType').on('change', async function () {
        ClearForm();
        ClearResponsible();
        ClearAnalysts();

        $('[id^="txtApproval"]').each(function (index, element) {
            $(this).remove()
        })

        arrayApprovals = [];
        if ($(this).val() != "") {
            FillResponsible(service, $(this).val(), buildingCode, null);
            $('#dynamicForm').html('');
            LoadForm(buildingCode, $(this).val());
            let newFilter = `Building eq '${buildingCode}' and Title eq '${service}' and SubServicio eq '${$(this).val()}'`;
            try {
                const data = await GetListByIDPromise(LISTAITSERVICES, 'DefaultLanguage', newFilter);
                let item = data.d.results;
                if (item != undefined) {
                    if (item[0].DefaultLanguage != null && item[0].DefaultLanguage != undefined && item[0].DefaultLanguage != "") {
                        Language = item[0].DefaultLanguage;
                        $('#ddlLanguage').val(Language.toLowerCase());
                        $('#ddlLanguage').change();
                    } else {
                        Language = 'en';
                    }
                }
            } catch (e) {
                console.log(e);
                return e;
            }
            arrayDefaultApprovals = [];
        }
    });
    //#endregion

    //#region Buttons
    $('#btnSubmit').on('click', function (e) {

        let validate = true;
        let msjError = '';

        $('#txtResponsableAsignado').removeClass('field-required is-invalid');

        $('#msjGeneral').text('');
        $('#msjGeneral').removeClass('alert-danger');
        $('#msjGeneral').show();

        $('.field-required').each(function () {
            if ($(this).val() == "" || $(this).val() == undefined) {
                $(this).addClass('is-invalid');
                if ($(this).attr('type') == 'file') {
                    if ($(this).prev('span').children().length > 0) {
                    } else {
                        validate = false;
                        msjError = '<span data-lang="FillFields"></span>';
                        $(this).prev().prev().prev().prev().removeClass('btn-primary');
                        $(this).prev().prev().prev().prev().addClass('btn-danger');
                    }
                }
                else {
                    validate = false;
                    msjError = '<span data-lang="FillFields"></span>';
                }
            }
        });

        if ($('.is-invalid').length > 0) {
            validate = false;
            msjError = '<span data-lang="FillFields"></span>';
        }

        let flag = false;
        let global;
        if ($('.btn-group-vertical').length > 0) {
            $('.btn-group-vertical').each(function () {
                flag = false;
                let idg = $(this).attr('id').split('_').pop();
                let mustValidate = $('#hf_' + idg).val() == "true";
                if (mustValidate) {
                    $(this).find('input[type="checkbox"]').each(function () {
                        if ($(this).is(':checked')) {
                            flag = true;
                        }
                    });
                    if (!flag) {
                        $(this).children().addClass('text-danger');
                        global = false;
                        msjError = ' <span data-lang="AtLeastOne"></span>';
                        return;
                    } else {
                        $(this).children().removeClass('text-danger');
                    }
                }
            });
        } else
            flag = true;

        let value = '';
        GetValueByKey('lblCDSIDde', Language, (v) => value = v);
        $('.cdsidctl').each(function (index, element) {
            if ($(this).closest('div').find('span').text().indexOf(value) > -1) {
                global = false;
                msjError = ' <span data-lang="CdsidError"></span>';
                $(this).addClass('is-invalid').removeClass('is-valid');
            }
        });

        $('[id^="txtApproval"]').each(function (index, element) {
            if ($(this).next('span').text().trim().indexOf(value.trim()) > -1) {
                global = false;
                msjError = ' <span data-lang="CdsidError"></span>';
                $(this).addClass('is-invalid').removeClass('is-valid');
            }
        });

        //if a CDSID is duplicated cannot submit
        let dup = '';
        GetValueByKey('lblCDSIDdu', Language, (v) => dup = v);
        $('#tblRequester tbody tr').each(function (index, element) {
            if ($(this).find('td:eq(0) span').text().trim().indexOf(dup.trim()) > -1 ||
                $(this).find('td:eq(0) span').text().trim().indexOf(value.trim()) > -1) {
                global = false;
                msjError = ' <span data-lang="CdsidDup"></span>';
            }
        });

        //Validate LL6+ approval
        let ll6Error = '', appError = '';
        GetValueByKey('msjApproverLL6', Language, (v) => ll6Error = v);
        GetValueByKey('msjApproverErr', Language, (v) => appError = v);
        $('[id^="txtApproval"]').each(function (index, element) {
            let label = $(this).next('span');
            if ($(label).text().trim().indexOf(ll6Error.trim()) > -1 ||
                $(label).text().trim().indexOf(appError.trim()) > -1) {
                global = false;
                msjError = ' <span data-lang="IncorrectApp"></span>';
            }
        });

        if (global != undefined && !global) {
            $('#msjGeneral').addClass('alert-danger');
            $('#msjGeneral').append("<strong>ERROR!</strong>&nbsp;" + msjError);
            loadLang($('#ddlLanguage').val().toLowerCase());
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        if (!validate) {
            e.preventDefault();
            e.stopPropagation();
            $('#msjGeneral').addClass('alert-danger');
            $('#msjGeneral').append("<strong>ERROR!</strong>&nbsp;" + msjError);
            loadLang($('#ddlLanguage').val().toLowerCase());
        } else {

            $.each($('input, textarea', '#dynamicForm'), function () {
                //text, file, checkbox
                if ($(this).prop('type') == 'checkbox' || $(this).prop('type') == 'radio') {
                    if ($(this).is(':checked')) {
                        $(this).attr('checked', 'checked');
                    }
                } if ($(this).prop('type') == 'textarea') {
                    $(this).text($(this).val());
                }
                else {
                    $(this).attr('value', $(this).val());
                }
            });

            $('#dynamicForm select').each(function () {
                $(this).find('option:selected').attr('selected', 'selected');
            });

            $('.sp-peoplepicker-editorInput').remove();
            $('.sp-peoplepicker-delImage').remove();
            $('.test-btn').remove();
            SaveRequest();

        }
    });
    //#endregion

    //#region others
    $('.field-required').on('blur change', function () {
        $(this).removeClass('is-valid');
        $(this).removeClass('is-invalid');
        if ($(this).val() == "" || $(this).val() == undefined) {
            $(this).addClass('is-invalid');
        } else {
            $(this).addClass('is-valid');
        }
    });

    $('#dvEncuesta input[type="radio"]').on('change', function (e) {
        $('#btnSubmitSurvey').show();
        $('#btnRestablecer').show();
    });

    $('#slt_locations_default').change(function () {
        window.location.replace(`${location.protocol}//${location.host}${location.pathname}?SiteCode=${this.value}`);
    });

    $('#txtAppComments').change(function () {

        if ($(this).val().length < 1) {
            $(this).addClass('is-invalid');
            $(this).remove('is-valid');
        } else {
            $(this).addClass('is-valid');
            $(this).removeClass('is-invalid');
        }

    });
    //#endregion

}

//==================================================================
//  set a value on a select field
//==================================================================
function loadInputByParameter(inputName, urlParameter, defaultValue = null) {

    let action = 0;

    if (getUrlParameter(urlParameter) != null) {
        if (existsInSelect(inputName, getUrlParameter(urlParameter))) {
            $('#' + inputName).val(getUrlParameter(urlParameter));
            action++;
        }
    }
    else {
        if (defaultValue != null) {
            if (existsInSelect(inputName, defaultValue)) {
                $('#' + inputName).val(defaultValue);
                action++;
            }
        }
    }

    if (action > 0) {
        // $('#' + inputName).change();
        $('#' + inputName).trigger('change');
    }

}

/**
 * Functions that validates if a value exists in a select input
 */
/**
 * 
 * @param inputName Name of a select input
 * @param valueToCheck Value that is going to be checked if exists in a select input
 * @returns Returns a boolean true if exists and false if it does not
 */
function existsInSelect(inputName, valueToCheck) {

    let IsExists = false;
    let ddloption = document.getElementById(inputName).options;

    for (let i = 0; i < ddloption.length; i++) {
        if (ddloption[i].value === valueToCheck) {
            IsExists = true;
            break;
        }
    }
    return IsExists;

}

/**
 * @description Loads all available languages per site
 */
async function loadLanguages() {
    let path = `${url}/_api/web/lists/GetByTitle('${LISTALANGUAGES}')/Items`;
    const response = await fetch(path, {
        method: 'GET',
        headers: POST
    });
    const data = await response.json();
    let items = data.d.results;
    $(items).each(function (index, element) {
        $('#ddlLanguage').append($(`<option data-text="${element.LanguageName}" data-lang="${element.LanguageName}" data-file="${element.LanguageFile}" value="${element.LanguageFile}">${element.Title}</option>`));
    });
}

//Function to change CDSID value in some controls and validate it
async function ChangeCDSID(control) {

    let CDSID = $(control).val();
    let username = domain + CDSID + FORD;
    let label = $(control).next('span');

    if (CDSID != "" && CDSID != undefined) {
        GetPeopleName(CDSID, label, true);
        try {
            const response = await GetPropertiesFor(username);
            newUser = response.d;
            FillNewCDSID(control);

            if (arrayApprovalsNull.length > 0) {
                lastRequestor();
            }

            IsReqEqApp();
            CDSIDDuplicates();
        } catch (e) {
            console.log(e);
        }
    } else {
        ClearReqData();
        $(label).empty();
    }
}

//Function to change CDSID of Analysts
async function ChangeCDSIDAnalysts(control) {

    let CDSID = $(control).val();
    let label = $(control).next('span');
    if (CDSID != "" && CDSID != undefined) {

        GetPeopleName(CDSID, label, true);
        try {
            const response = await GetPropertiesFor(domain + CDSID + FORD);
            newUser = response.d;
            FillNewCDSID(control);
        } catch (e) {
            alert(JSON.stringify(e));
            console.log(e);
        }
    } else {
        ClearReqData();
        $(label).empty();
    }
}

//This function loads services from an especific building provided
async function LoadServices(building) {
    building == undefined ? building = "" : building = building;
    if ($('#currentRequestId').val() == "0") {
        buildingCode = building == "" ? getUserProperty("FordBuildingNo") : building;

        let filtro = `Building eq '${buildingCode}'`;
        const data = await GetListByQuery(url, LISTAITSERVICES, filtro, "");
        let services = Array.from(new Set(data.d.results.map(function (value) {
            return value.Title;
        })));
        services = services.sort();
        FillDDL('ddArea', services);
        loadInputByParameter('ddArea', 'service');
    }
}

//Fills an html select input with values provided
function FillDDL(control, values) {
    let ddl = $('#' + control);
    $(ddl).empty().append('<option data-lang="optSelectText" value=""></option>');
    $.each(values, function (indexInArray, valueOfElement) {
        $(ddl).append(new Option(valueOfElement, valueOfElement));
    });
    $('#ddlLanguage').change();
}

//Fills an html select input with values provided and its text/value properties
function FillDDL2(control, values, texto, valor) {
    let ddl = $('#' + control);
    $(ddl).empty().append('<option data-lang="optSelectText" value=""></option>');
    $.each(values, function (indexInArray, valueOfElement) {
        $(ddl).append(new Option(valueOfElement[texto], valueOfElement[valor]));
    });
    $('#ddlLanguage').change();
}

//Fills analysts and approvals for a request type
async function FillResponsible(service, subservice, building, approvals) {

    try {
        let appId = "";
        let appName = "";
        let appDate = "";
        let appComments = "";
        let appTitle = "";
        let analista;
        let backup;
        let filtro = "Building eq '" + building + "' and Title eq '" + service + "' and SubServicio eq '" + subservice + "'";
        const response = await GetListByQuery(url, LISTAITSERVICES, filtro, "");
        if ($('#currentRequestId').val() == "0") {

            analista = cleanCDSIDDomain(response.d.results[0].Analista).toUpperCase().trim();
            backup = (response.d.results[0].Email_Analista !== null) ? cleanCDSIDDomain(response.d.results[0].Email_Analista).toUpperCase().trim() : null;
            ClearResponsible();
            ClearAnalysts();
            //mensaje de alerta si no esta configurado un analista
            if (backup != "" && backup != undefined) {
                backup = backup.toUpperCase();
                backup = backup.replace(",", ";");
                $('#linkAnalyst').show();
            } else {
                $('#linkAnalyst').hide();
            }
            if (analista != "" && analista != undefined) {
                analista = analista.indexOf('\\') > -1 ? analista.split('\\')[1] : analista;
                $('#lblResponsableAsignado').text("( " + analista + " )");
                GetPeopleName(analista, 'lblResponsableAsignadoNombre');
            }
            if (backup != "" && backup != undefined) {
                $('#lblAnalistasAsignados').text(backup);
            }
            //Fills approvals from list Approvals
            filtro = "Title eq '" + building + "' and Servicio eq '" + service + "' and Subservicio eq '" + subservice + "'";
            const data = await GetListByQuery(url, LISTAAPPROVALS, filtro, "");
            let filtered = data.d.results.filter(function (value) {
                return value.ApprovalOrder != 1;
            });
            let isSecuential = filtered.length > 0;
            globalIsSec = isSecuential; //global variable setted.
            if (isSecuential) {
                //Secuential approval flow
                FillApprovals(data).then(function () {
                    //check if it should be LL6 + and that it is not within the requesters
                    let solicitantes = GetRequesters();
                    let filtered = arrayAppCheck.filter(function (value) {
                        return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                    });
                    $(filtered).each(function (index, element) {
                        let label = $('#txtApproval' + element.order).next('span');
                        let msj = '';
                        GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                        $(label).empty().text(msj);
                        $(label).addClass('text-danger').removeClass('text-info');
                    });
                });
            } else {
                //Random approval flow
                if (data.d.results.length > 0) {
                    FillApprovalsRamdon(data).then(function () {
                        let solicitantes = GetRequesters();
                        let filtered = arrayAppCheck.filter(function (value) {
                            return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                        });
                        $(filtered).each(function (index, element) {
                            let label = $('#txtApproval' + element.order).next('span');
                            let msj = '';
                            GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                            $(label).empty().text(msj);
                            $(label).addClass('text-danger').removeClass('text-info');
                        });
                    });
                } else {
                    //skip approval chain
                    $('#approvalsSection').hide();
                }
            }
        }
        else if ($('#currentRequestId').val() != "0") {
            let jsonAnalysts = GetJSONAnalysts();
            let itemjsonAnalysts = JSON.parse(jsonAnalysts);
            analista = itemjsonAnalysts[0].analyst.toUpperCase();
            backup = itemjsonAnalysts[0].backup;
            if (backup != "" && backup != undefined) { backup = backup.toUpperCase(); backup = backup.replace(",", ";"); }
            arrayOfAnalistas.push(cleanCDSIDDomain(analista.trim().toUpperCase()));
            !isNullOrWhitespace(backup) ? backup.split(';').forEach((v) => { arrayOfAnalistas.push(v.trim().toUpperCase()) }) : null;
            //json approvals
            //1.) paint table with info of approvers who already approved
            //2.) checks if the logged in user is the current approver to display controls
            //Step one
            let tabla = $('#approvalsSection').find('table');
            let app = JSON.parse(approvals);
            globalJsonApp = app;
            let i = 1;
            let isSetAP = false;
            //---------------------------------------------------------------
            // mejora bloques de aprobadores
            //---------------------------------------------------------------
            let findBlocks = {};
            let blocks = false;
            $.each(app, function (index, element) {
                if (findBlocks[element.ApprovalOrder] == undefined) {
                    findBlocks[element.ApprovalOrder] = 1;
                }
                else if ($('#lblStatus').val() !== SURVEY) {
                    findBlocks[element.ApprovalOrder]++;
                    blocks = true;
                }
            });
            //---------------------------------------------------------------
            if (app.length > 0) {
                //Checks if secuential or random approval flow
                let filtered = app.filter(function (value) { return value.ApprovalOrder != 1; });
                let isSec = filtered.length > 0;
                if (isSec && !blocks) {
                    //Secuential
                    app.forEach((value) => {
                        if (value.Approval != "" && value.Approval != "undefined") {
                            appId = value.Approval.split(';')[0].toUpperCase();
                            appName = value.Name;
                            appDate = value.Date;
                            appComments = value.Comments;
                            appTitle = value.Title;
                            let appRequest = GetRequesters();
                            let appResult = false;
                            if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() != appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                                //SI EL APROBADOR ES DIFERENTE AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                                appId = userLogin.toUpperCase();
                                appName = displayName;
                                if (appDate == null) { appAprobado = true; }
                                userApprover = userLogin;
                            } else if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() == appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                                //SI EL APROBADOR ES IGUAL AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                                appId = userLogin.toUpperCase();
                                appName = displayName;
                                if (appDate == null) { appAprobado = true; }
                                userApprover = userLogin;
                            }
                            if (appAprobado) {
                                appResult = appRequest.indexOf(appId.toUpperCase()) < 0;
                                if (!appResult) {
                                    appId = value.Approval.split(';')[0].toUpperCase();
                                    appName = value.Name;
                                }
                            }
                            let classA = "bg-blue";
                            let columna = '<tr class="' + classA + '"><td class="text-center">' + i + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                            if (!isNullOrWhitespace(appDate)) {
                                columna = '<tr><td class="text-center">' + i + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                                let comments = appComments == null ? "" : "<br>" + appComments;
                                columna += '<span><br>' + appDate + ' ' + comments + '</span>';
                            } else {
                                if (!isSetAP) {
                                    $('#hfActualApp').val(appId);
                                    isSetAP = true;
                                } else {
                                    columna = '<tr><td class="text-center">' + i + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                                }
                            }
                            columna += '</td><td><b>' + appTitle + '</b>' + (!isNullOrWhitespace(appDate) ? '&nbsp;<span class="text-success"><i class="fa fa-check-circle" aria-hidden="true"></i></span>' : '') + '</td></tr>';
                            $(tabla).find('tbody').append($.parseHTML(columna));
                            i++;
                        }
                    });
                    $('#approvalsSection').show();
                    //Step two
                    if (_spPageContextInfo.userLoginName.split('@')[0].toUpperCase() == $('#hfActualApp').val().toUpperCase() && $('#lblStatus').text() != REJECTED) {
                        $('#secApprover').show();
                        $('#secApprover').find('input, button, textarea').removeAttr('disabled');
                    } else if (_spPageContextInfo.userLoginName.split('@')[0].toUpperCase() == creatorCDSID.toUpperCase() && $('#lblStatus').text() == REJECTED) {
                        //Load editables approvals
                        FillApprovals(approvals, true).then(function () {
                            let solicitantes = GetRequesters();
                            let filtered = arrayAppCheck.filter(function (value) {
                                return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                            });
                            $(filtered).each(function (index, element) {
                                let label = $('#txtApproval' + index + 1).next('span');
                                let msj = '';
                                GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                                $(label).empty().text(msj);
                                $(label).addClass('text-danger').removeClass('text-info');
                            });
                        });
                        $('#approvalsSection').show();
                        $('#secApprover').remove();
                    } else {
                        $('#secApprover').remove();
                    }
                } else if (!blocks) {
                    i = 1;
                    globalAppRandom = app;
                    globalIsSec = false;
                    //Random approval flow
                    let appAprobado = false;
                    let userApprover = "";
                    let approvers = [];
                    let appOrder;
                    let appRequest = GetRequesters();
                    let appResult = false;
                    app.forEach((value) => {
                        appId = value.Approval.split(';')[0].toUpperCase();
                        appName = value.Name;
                        appDate = value.Date;
                        appComments = value.Comments;
                        appTitle = value.Title;
                        appOrder = value.ApprovalOrder;
                        if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() != appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                            //SI EL APROBADOR ES DIFERENTE AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                            appId = userLogin.toUpperCase();
                            appName = displayName;
                            if (appDate == null) { appAprobado = true; }
                            userApprover = userLogin;
                        } else if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() == appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                            //SI EL APROBADOR ES IGUAL AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                            appId = userLogin.toUpperCase();
                            appName = displayName;
                            if (appDate == null) { appAprobado = true; }
                            userApprover = userLogin;
                        }
                        //VALIDA SI EL APROBADOR EXISTE EN LA LISTA DE SOLICITANTES
                        if (appAprobado) {
                            appResult = appRequest.indexOf(appId.toUpperCase()) < 0;
                            if (!appResult) {
                                appId = value.Approval.split(';')[0].toUpperCase();
                                appName = value.Name;
                                appDate = value.Date;
                                appComments = value.Comments;
                                appTitle = value.Title;
                            }
                        }
                        let classA = "bg-blue";
                        let columna = '<tr class="' + classA + '"><td class="text-center">' + appOrder + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                        if (!isNullOrWhitespace(appDate)) {
                            columna = '<tr><td class="text-center">' + appOrder + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                            let comments = appComments == null ? "" : "<br>" + appComments;
                            columna += '<span><br>' + appDate + ' ' + comments + '</span>';
                        } else {
                            columna = '<tr class="' + classA + '"><td class="text-center">' + appOrder + '</td><td colspan="2" width="45%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                        }
                        //
                        columna += '</td><td><b>' + appTitle + '</b>' + (!isNullOrWhitespace(appDate) ? '&nbsp;<span class="text-success"><i class="fa fa-check-circle" aria-hidden="true"></i></span>' : '') + '</td></tr>';
                        $(tabla).find('tbody').append($.parseHTML(columna));
                        approvers.push({ Approval: appId, Date: appDate });
                        i++;
                    });
                    $('#approvalsSection').show();
                    //Step two
                    if (appAprobado && appResult && $('#lblStatus').text() != REJECTED) {
                        $('#secApprover').show();
                        $('#secApprover').find('input, button, textarea').removeAttr('disabled');
                        //Current background color approval in blue
                        $(tabla).find('tbody tr').each(function () {
                            let item = $(this).find('td:eq(1) span').html();
                            let item2 = $(this).find('td:eq(2) span').html();
                        });
                    } else if (_spPageContextInfo.userLoginName.split('@')[0].toUpperCase() == creatorCDSID.toUpperCase() && $('#lblStatus').text() == REJECTED) {
                        FillApprovalsRamdon(approvals, true).then(function () {
                            let solicitantes = GetRequesters();
                            let filtered = arrayAppCheck.filter(function (value) {
                                return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                            });
                            $(filtered).each(function (index, element) {
                                let label = $('#txtApproval' + index + 1).next('span');
                                let msj = '';
                                GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                                $(label).empty().text(msj);
                                $(label).addClass('text-danger').removeClass('text-info');
                            });
                        });
                        $('#approvalsSection').show();
                        $('#secApprover').remove();
                    } else {
                        $('#secApprover').remove();
                    }
                } else if (blocks) {
                    i = 1;
                    globalAppRandom = app;
                    globalIsSec = false;
                    //Random approval flow
                    let appAprobado = false;
                    let userApprover = "";
                    let approvers = [];
                    let appOrder;
                    let appRequest = GetRequesters();
                    let appResult = false;
                    let findBlocks = {};
                    let pendingApp = [];
                    let currentUserLevel = 0;
                    let currentLevel = 0;
                    let includesApp = false;
                    let foundUser = false;
                    let currentUsrLvl = 0;
                    app.forEach((value) => {
                        appId = value.Approval.split(';')[0].toUpperCase();
                        appName = value.Name;
                        appDate = value.Date;
                        appComments = value.Comments;
                        appTitle = value.Title;
                        appOrder = value.ApprovalOrder;
                        if (value.Date == null && currentLevel == 0) currentLevel = value.ApprovalOrder;
                        if (value.Date == null && currentUsrLvl == 0 && value.Approval.split(';').includes(userLogin) && value.ApprovalOrder == currentLevel) currentUsrLvl = value.ApprovalOrder;
                        if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() != appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                            //SI EL APROBADOR ES DIFERENTE AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                            appId = userLogin.toUpperCase();
                            appName = displayName;
                            if (appDate == null) { appAprobado = true; }
                            userApprover = userLogin;
                        } else if (value.Approval.toUpperCase().indexOf(userLogin.toUpperCase()) >= 0 && userLogin.toUpperCase() == appId.toUpperCase() && isNullOrWhitespace(appDate)) {
                            //SI EL APROBADOR ES IGUAL AL USUARIO QUE INGRESO Y TAMBIEN EXISTE EN LA LISTA CON FECHA NULL
                            appId = userLogin.toUpperCase();
                            appName = displayName;
                            if (appDate == null) { appAprobado = true; }
                            userApprover = userLogin;
                        }
                        //VALIDA SI EL APROBADOR EXISTE EN LA LISTA DE SOLICITANTES
                        if (appAprobado) {
                            appResult = appRequest.indexOf(appId.toUpperCase()) < 0;
                            if (!appResult) {
                                appId = value.Approval.split(';')[0].toUpperCase();
                                appName = value.Name;
                                appDate = value.Date;
                                appComments = value.Comments;
                                appTitle = value.Title;
                            }
                        }
                        let classA = (appId == userLogin && currentUsrLvl == currentLevel && value.Date == null && appOrder == currentLevel) ? "bg-blue" : "";
                        let columna = '<tr class="' + classA + '"><td class="text-center">' + appOrder + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                        if (!isNullOrWhitespace(appDate)) {
                            columna = '<tr class="' + classA + '"><td class="text-center">' + appOrder + '</td><td colspan="2" width="65%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                            let comments = appComments == null ? "" : "<br>" + appComments;
                            columna += '<span><br>' + appDate + ' ' + comments + '</span>';
                        } else {
                            columna = '<tr class="' + classA + '"><td class="text-center">' + appOrder + '</td><td colspan="2" width="45%" class="text-truncate" style="max-width: calc( 30 * 1vw )"><span>' + appId + ' - ' + appName + ' </span>';
                        }
                        //
                        columna += '</td><td><b>' + appTitle + '</b>' + (!isNullOrWhitespace(appDate) ? '&nbsp;<span class="text-success"><i class="fa fa-check-circle" aria-hidden="true"></i></span>' : '') + '</td></tr>';
                        $(tabla).find('tbody').append($.parseHTML(columna));
                        approvers.push({ Approval: appId, Date: appDate });
                        //-------------------------------------------
                        //  mejora bloques aprobadores
                        //-------------------------------------------
                        if (i == 1) {
                            $.each(JSON.parse(approvals), function (index, element) {
                                if (findBlocks[element.ApprovalOrder] == undefined && element.Date == null) {
                                    findBlocks[element.ApprovalOrder] = [element];
                                    if (Object.keys(findBlocks).length == 1) currentLevel = element.ApprovalOrder;
                                    pendingApp.push(element.Approval);
                                }
                                else if (element.Date == null) {
                                    findBlocks[element.ApprovalOrder].push(element);
                                    pendingApp.push(element.Approval);
                                }
                                if (element.Approval.includes(userLogin) && element.Date == null && !foundUser) {
                                    currentUserLevel = element.ApprovalOrder;
                                    foundUser = true;
                                }
                            });
                            $.each(pendingApp, function (index, element) {
                                if (element.includes(userLogin)) {
                                    includesApp = true;
                                }
                            });
                        }
                        if (userLogin.toUpperCase() == appId && $('#lblStatus').text() != REJECTED && currentLevel == currentUserLevel && includesApp) {
                            $('#secApprover').show();
                            $('#secApprover').find('input, button, textarea').removeAttr('disabled');
                        }
                        //-------------------------
                        i++;
                    });
                    if ($('#lblStatus').html() !== SURVEY) $('#approvalsSection').show();
                    let appList = [];
                    $.each(approvers, function (index, element) {
                        appList.push(element.Approval)
                    });
                    //Step two
                    if (appList.includes(_spPageContextInfo.userLoginName.split('@')[0].toUpperCase()) && $('#lblStatus').text() != REJECTED && $('#lblStatus').text() != COMPLETED && $('#lblStatus').text() != SURVEY && $('#lblStatus').text() != ANALYST && currentLevel == currentUserLevel) {
                        $('#secApprover').show();
                        $('#secApprover').find('input, button, textarea').removeAttr('disabled');
                    } else if (_spPageContextInfo.userLoginName.split('@')[0].toUpperCase() == creatorCDSID.toUpperCase() && $('#lblStatus').text() == REJECTED && $('#lblStatus').text() != ANALYST) {
                        //Load editables approvals
                        FillApprovals(approvals, true).then(function () {
                            let solicitantes = GetRequesters();
                            let filtered = arrayAppCheck.filter(function (value) {
                                return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                            });
                            $(filtered).each(function (index, element) {
                                let label = $('#txtApproval' + index + 1).next('span');
                                let msj = '';
                                GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                                $(label).empty().text(msj);
                                $(label).addClass('text-danger').removeClass('text-info');
                            });
                        });
                        $('#approvalsSection').show();
                        $('#secApprover').remove();
                    } else {
                        $('#secApprover').remove();
                        $('#approvalsSection').show();
                    }
                }
            }
        } else {
            //skip app chain
            $('#approvalsSection').hide();
        }
        //Closing section
        if (statusActualReq == ANALYST) {
            const response = await GetListByID(url, LISTAUNIVERSALREQUEST, $('#currentRequestId').val());
            if (response != null) {
                let item = response;
                if (isNullOrWhitespace(item['DynamicFormAnalyst']) &&
                    isNullOrWhitespace(item['DynamicFormRequester']))
                    LoadForm(building.toString().trim(), subservice, true);
                else {
                    $('#ctlForRequestor').html('');
                    $('#ctlForRequestor').append(item['DynamicFormRequester']);
                    $('#ctlForRequestor').removeClass('d-none');
                    $('#ctlForAnalyst').html('');
                    $('#ctlForAnalyst').append(item['DynamicFormAnalyst']);
                    $('#ctlForAnalyst').removeClass('d-none');
                    //attach events on controls
                    $('#ctlRequest input.datepicker, #ctlAnalyst input.datepicker').removeClass('hasDatepicker');
                    $('#ctlRequest input.datepicker_alt, #ctlAnalyst input.datepicker').removeClass('hasDatepicker');
                    $('#ctlRequest input.datepicker, #ctlAnalyst input.datepicker').datepicker({ dateFormat: 'MM dd yy', changeYear: true, changeMonth: true });
                    $('#ctlRequest input.datepicker_alt, #ctlAnalyst input.datepicker').datepicker({ dateFormat: 'yy-mm-dd', changeYear: true, changeMonth: true, yearRange: '-80:+2' });
                }
                let campos = "RequestID,LinkFilename,Title,Order0";
                let filtro = "RequestID eq " + $('#currentRequestId').val();
                try {
                    const data = await GetListByIDPromise(LISTAATTACHMENTS, campos, filtro);
                    let newItem = data.d.results;
                    $(newItem).each(function (index, element) {
                        let downloadLink = '<a href="' + url + '/' + LISTAATTACHMENTS + '/' + newItem[index].LinkFilename + '" class="btn btn-dark btn-block mb-2" style="color:#fff" target="_blank">' + newItem[index].Title + ' <i class="fa fa-download" aria-hidden="true"></i></a>';
                        let file = $('input[type="file"]')[newItem[index].Order0 - 1];
                        if ($(file).closest('td').length > 0) {
                            let title = '';
                            let lang = $('#ddlLanguage').val();
                            GetValueByKey('lblDownload', lang, function (data) { title = data; });
                            downloadLink = '<a href="' + url + '/' + LISTAATTACHMENTS + '/' + newItem[index].LinkFilename + '" class="btn btn-dark btn-block mb-2" style="color:#fff" target="_blank"><span data-lang="lblDownload">' + title + '</span> <i class="fa fa-download" aria-hidden="true"></i></a>';
                        }
                        $(file).prev('span').empty().append(downloadLink);
                    });
                } catch (e) {
                    console.log(e);
                    return e;
                }
                if (creatorCDSID == userLogin) {
                    $('#dvClosure').find('textarea, button').removeAttr('disabled');
                    $('#txtCommentsClosureAnalyst').attr('disabled', 'disabled');
                    $('#dvBtnClosing').removeClass('d-none');
                    $('#dvbtnClosedClosure').addClass('d-none');
                    $('#dvbtnCancelClosure').addClass('d-none');
                    $('#ctlForRequestor').find('input,select,button').removeAttr('disabled');
                    $('#ctlForRequestor').find('input[type="file"]').prev().prev().prev().prev().removeClass('btn-disabled').addClass('btn-primary');
                    $('#ctlForAnalyst').find('input,select,button').attr('disabled', 'disabled');
                    $('#ctlForAnalyst').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
                } else if (arrayOfAnalistas.includes(userLogin)) {
                    $('#dvClosure').find('textarea, button').removeAttr('disabled');
                    $('#dvBtnClosing').removeClass('d-none');
                    $('#txtCommentsClosureRequest').attr('disabled', 'disabled');
                    $('#dvbtnClosedClosure').removeClass('d-none');
                    $('#dvbtnCancelClosure').removeClass('d-none');
                    $('#ctlForRequestor').find('input,select,button').attr('disabled', 'disabled');
                    $('#ctlForRequestor').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
                    $('#ctlForAnalyst').find('input,select,button').removeAttr('disabled');
                    $('#ctlForAnalyst').find('input[type="file"]').prev().prev().prev().prev().removeClass('btn-disabled').addClass('btn-primary');
                }
            }
            $('#dvClosure').removeClass('d-none');
            if ((!isNullOrWhitespace(analista) ? analista.trim() : "") == userLogin
                || (!isNullOrWhitespace(backup) ? backup.trim() : "") == userLogin) {
                $('#dvClosure').find('textarea, button').removeAttr('disabled');
                $('#dvBtnClosing').removeClass('d-none');
                $('#txtCommentsClosureRequest').attr('disabled', 'disabled');
            }
        }
        if (statusActualReq == CANCELLED) {
            $('#dvClosure').removeClass('d-none');
            if ((!isNullOrWhitespace(analista) ? analista.trim() : "") == userLogin
                || (!isNullOrWhitespace(backup) ? backup.trim() : "") == userLogin) {
                $('#dvClosure').find('textarea, button').attr('disabled', 'disabled');
                $('#dvBtnClosing').addClass('d-none');
            }
        }
        //End closing section
        //Approvals - validate if it already has comments and closing date to enable it for ADMIN
        if (arrayAdministrators.indexOf(userCDSID) >= 0
            && $('#currentRequestId').val() != "0"
            && statusActualReq != SURVEY
            && statusActualReq != COMPLETED
            && statusActualReq != CANCELLED) {
            $('#dvAdministrator').removeClass('d-none');
            //If logged in user is the requestor and was rejected, shows submit button
            if (creatorCDSID == userLogin && statusActualReq == REJECTED) {
                $('#btnSubmit').show();
            }
            else {
                $('#btnSubmit').hide();
            }
            $('#txtAdminJustification').removeAttr('disabled');
            $('#btnSaveAdmin').removeAttr('disabled');
            $('#btnCancelAdm').removeAttr('disabled');
            //Enable textboxes for ADMIN
            $('#dvlblResponsable').addClass('d-none');
            $('#dvtxtResponsable').removeClass('d-none');
            $('#dvlblBackup').addClass('d-none');
            let analyst = $('#lblResponsableAsignado').text();
            analyst = analyst.replace("(", "").replace(")", "").trim();
            $('#txtResponsableAsignado').val(analyst).removeAttr('disabled');
            if (!isNullOrWhitespace(analyst)) {
                $('#txtResponsableAsignado').blur();
            }
            if (app.length > 0) {
                //If logged in user is ADMIN user, ENABLE THE CHANGE OF APPROVERS WHO HAVE NOT YET APPROVED
                FillApprovals(approvals, true).then(function () {
                    let solicitantes = GetRequesters();
                    let filtered = arrayAppCheck.filter(function (value) {
                        return solicitantes.indexOf(!isNullOrWhitespace(value.CDSID) ? value.CDSID.toUpperCase() : value.CDSID) > -1;
                    });
                    $(filtered).each(function (index, element) {
                        let label = $('#txtApproval' + index + 1).next('span');
                        let msj = '';
                        GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                        $(label).empty().text(msj);
                        $(label).addClass('text-danger').removeClass('text-info');
                    });
                });
            }
        }
    } catch (error) {
        console.log('error: ', error);
    }
}

function ClearResponsible() {
    $('#lblResponsableAsignado').text('');
    $('#lblResponsableAsignadoNombre').text('');
    $('#txtResponsableAsignado').val('');
}

function ClearForm() {
    $('#txtDescriptionJustify').val('');
    $('#msjGeneral').text('');
    $('#msjGeneral').hide();
    $('#dynamicForm').html('');
    $('.approvals').html('');
    $('#approvalsSection').hide();
}

//Fills requester data
async function fillRequestorData() {

    $('#lblRequestDate').text(new Date().toLocaleString());
    $('#lblStatus').text('New Request');

    let fila = $('.txtRequest').closest('tr');

    let department = GetByProp(objUser.UserProfileProperties.results, "Department");
    let empType = GetByProp(objUser.UserProfileProperties.results, "EmployeeType");
    let manager = GetByProp(objUser.UserProfileProperties.results, "Manager");
    manager = manager.split('|').pop().split('@')[0].toString().toUpperCase();

    let CDSID = objUser.Email.split('@')[0].toString().toUpperCase();
    CDSIDReq = objUser.UserProfileProperties.results[3].Value;

    $(fila).find('td:eq(0) input').val(CDSID);
    $(fila).find('td:eq(0) input').trigger('blur');
    $(fila).find('td:eq(1) span').text(department);
    $(fila).find('td:eq(2) span').text(empType);
    $(fila).find('td:eq(3) span').text(manager);

    const data = await GetPeoplePicker(manager);

    $(fila).find('td:eq(4) span').text(data.d.DisplayName);

}

function FillNewCDSID(control) {

    let fila = $(control).closest('tr');
    let lang = $('#ddlLanguage').val();
    let value = '';
    if (newUser == undefined) {
        ClearReqData();
        GetValueByKey('lblCDSIDde', lang, (v) => value = v);
        $(control).next('span').empty().text(value);
        $('#btnSaveAdmin').attr('disabled', 'disabled');
        return;
    } else {

        if (!isNullOrWhitespace(newUser.UserProfileProperties)) {
            let arr = newUser.UserProfileProperties.results;
            $('#btnSaveAdmin').removeAttr('disabled');
            let department = GetByProp(arr, "Department");
            let empType = GetByProp(arr, "EmployeeType");
            let manager = GetByProp(arr, "Manager");
            manager = manager.split('|').pop().split('@')[0].toString().toUpperCase();

            let CDSID = ""
            if (newUser.Email !== null) {
                CDSID = newUser.Email.split('@')[0].toUpperCase();
            }
            else {
                CDSID = newUser.UserProfileProperties.results[18].Value.split('@')[0].toUpperCase();
            }
            CDSIDReq = GetByProp(arr, "AccountName");

            $(fila).find('td:eq(1) span').text(department);
            $(fila).find('td:eq(2) span').text(empType);
            $(fila).find('td:eq(3) span').text(manager);
            $(control).next('span').addClass('text-info').removeClass('text-danger');

            GetPeopleName(manager, $(fila).find('td:eq(4) span'), true);
        }
    }

}

function ClearReqData(fila) {

    let row = $(fila).closest('tr');

    $(row).find('td:eq(1) span').text('');
    $(row).find('td:eq(2) span').text('');
    $(row).find('td:eq(3) span').text('');
    $(row).find('td:eq(4) span').text('');

}

function prepareNewRequest() {

}

async function LoadRequestData(item) {
    //Load the form
    let data = await GetListByID(url, LISTAUNIVERSALREQUEST, item)
    data = data.d;
    
    let building = data.LocationID.split('-').shift();
    let filtro = `Building eq '${building}' and Title eq '${data.Service}' and SubServicio eq '${data.Subservice}'`;
    let dynamicForm = data.DynamicForm;
    const dataQ = await GetListByQuery(url, LISTAITSERVICES, filtro, '');

    Language = 'en';
    if (!isNullOrWhitespace(dataQ.d.results[0]))
        Language = dataQ.d.results[0].DefaultLanguage;
    creatorCDSID = data.CreatorCDSID;
    statusActualReq = data.Status;
    let CDSID = data.RequestCDSID.split(';');
    let i = 0;
    CDSID.forEach(function (item, index) {
        if (!isNullOrWhitespace(item)) {
            i += 1;
            if (i > 1) {
                AddRequest($('#tblRequester').find('tfoot button'));
                $('#tblRequester').find('tbody tr:eq(' + (i - 1) + ') td:eq(0) input').val(item);
                $('#tblRequester').find('tbody tr:eq(' + (i - 1) + ') td:eq(0) input').blur();
            } else {
                $('#tblRequester').find('tbody tr td:eq(0) input').val(item);
                $('#tblRequester').find('tbody tr td:eq(0) input').blur();
            }
        }
    });
    $('#ddlLanguage').val(data.LanguageCode.toLowerCase());
    $('#ddlLanguage').change();
    $('#lblRequestDate').text(new Date(data.RequestDate).toLocaleString());
    $('#lblID').text(data.Id);
    $('#lblStatus').text(data.Status);
    $('#ddBuilding').append(new Option(data.LocationID, data.LocationID));
    $('#ddBuilding').val(data.LocationID);
    $('#ddArea').append(new Option(data.Service, data.Service));
    $('#ddArea').val(data.Service);
    $('#ddRequestType').append(new Option(data.Subservice, data.Subservice));
    let buildingCode = data.LocationID.indexOf('-') > -1 ? data.LocationID.split('-')[0] : data.LocationID;
    let analista;
    let backup
    if (!isNullOrWhitespace(data.Analysts)) {
        let jsonAnalysts = JSON.parse(cleanCDSIDDomain(data.Analysts));
        analista = jsonAnalysts[0].analyst.toUpperCase().trim();
        backup = jsonAnalysts[0].backup.toUpperCase().trim();
        ClearResponsible();
        if (analista != "" && analista != undefined) {
            analista = analista.indexOf('\\') > -1 ? analista.split('\\')[1] : analista;
            $('#lblResponsableAsignado').text("( " + analista + " )");
            GetPeopleName(analista, 'lblResponsableAsignadoNombre');
        }
        if (backup != "" && backup != undefined) {
            backup = backup.replace(",", ";");
            $('#lblAnalistasAsignados').text(backup);
        } else { $('#linkAnalyst').hide(); }
    }
    GetAdministrators(buildingCode, data.Service).then(async (adm) => {
        let analista;
        let backup;
        if (adm.d.results.length > 0) {
            analista = adm.d.results[0].Analista;
            backup = adm.d.results[0].Email_Analista;
            if (analista != "" && analista != undefined) {
                analista = analista.indexOf('\\') > -1 ? analista.split('\\')[1] : analista;
                arrayAdministrators.push(analista);
            }
            //VALIDAR LOS BACKUPS
            if (backup != "" && backup != undefined) {
                backup = backup.replace(",", ";");
                backup = backup.indexOf('\\') > -1 ? backup.split('\\')[1] : backup;
                arrayAdministrators.push(backup);
            }
        }
        FillResponsible(data.Service, data.Subservice, buildingCode, data.Approvals);
        $('#hfDataApp').val(data.Approvals);
        $('#dynamicForm').remove();
        $('#load_data').append(data.DynamicForm);
        //attach event to checkboxes
        $('#dynamicForm input[type="checkbox"], input[type="radio"]').on('change', function () {
            $(this).attr('checked', $(this).is(':checked'));
        });
        if (data.Status != REJECTED) {
            $('#btnSubmit').parent().parent().remove();
            $('#msjGeneral').parent().parent().remove();
            $('#main.container').find('input, textarea, button, select').attr('disabled', 'disabled');
            $('#dynamicForm').find('input, textarea, button, select').attr('disabled', 'disabled');
            $('#dynamicForm').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
            $('#linkAnalyst').removeAttr('disabled');
        } else {
            if (data.CreatorCDSID == userLogin) {
                $('#btnSubmit').removeAttr('disabled');
                $('#ddRequestType').attr('disabled', 'disabled');
                $('#ddArea').attr('disabled', 'disabled');
                $('#ddBuilding').attr('disabled', 'disabled');
                //attach events on controls
                $('#dynamicForm input.datepicker').removeClass('hasDatepicker');
                $('#dynamicForm input.datepicker_alt').removeClass('hasDatepicker');
                $('#dynamicForm input.datepicker').datepicker({ dateFormat: 'MM dd yy', changeYear: true, changeMonth: true });
                $('#dynamicForm input.datepicker_alt').datepicker({ dateFormat: 'yy-mm-dd', changeYear: true, changeMonth: true, yearRange: '-80:+2' });
                $('#linkAnalyst').removeAttr('disabled');
            } else {
                $('#btnSubmit').parent().parent().remove();
                $('#msjGeneral').parent().parent().remove();
                $('#dynamicForm').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
                $('#main.container').find('input, textarea, button, select').attr('disabled', 'disabled');
                $('#dynamicForm').find('input, textarea, button, select').attr('disabled', 'disabled');
                $('#linkAnalyst').removeAttr('disabled');
            }
        }
        $('#txtDescriptionJustify').val(data.Justification);
        $('#txtDescriptionJustify').removeClass('is-invalid').addClass('is-valid');
        if (data.Status == SURVEY && data.CreatorCDSID == userLogin) {
            $('#dvEncuesta').modal("show");
            $('#dvClosure').removeClass('d-none');
            $('#dvBtnClosing').addClass('d-none');
        }
        if (!isNullOrWhitespace(data.Survey)) {
            try {
                let survey = JSON.parse(data.Survey);
                if (survey.SeAtendio == "SI")
                    $('#atendio').addClass('text-success');
                else
                    $('#atendio').addClass('text-danger');
                $('#atendio').text(survey.SeAtendio);
                $('#nivel').text(survey.NivelSatisfaccion);
                $('#surveyComments').text(survey.Comentarios);
                $('#dvRespEncuesta').show();
            } catch (error) {
                console.log(error);
            }
        }
        let txtLog = isNullOrWhitespace(data.Log) ? '' : data.Log.replace(/\n/g, '<br>');
        $('#dvLOG').find('.card-body.text-muted').append(txtLog);
        $('#dvLOG').show();
        arrayJsonApprovals = JSON.parse(data.Approvals);
        if (data.Status == CANCELLED) {
            //Checks if logged in user is analyst or requester
            let reqCDSID = "";
            $('#tblRequester').find('tbody tr').each(function () {
                reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
            });
            let CC = reqCDSID.split(';');
            CC = CC.filter(function (value) {
                return value != "";
            });
            if (CC.includes(userLogin)) {
                $('#dvClosure').find('textarea, button').attr('disabled', 'disabled');
                $('#dvClosure').removeClass('d-none');
            }
        }
        //Get closing
        if (!isNullOrWhitespace(data.Closing)) {
            try {
                let jsonClosing = JSON.parse(data.Closing);
                $("#txtCommentsClosureRequest").val(jsonClosing.commentsRequest);
                $("#txtCommentsClosureAnalyst").val(jsonClosing.commentsAnalyst);
                $("#lblDateClosure").text(jsonClosing.dateClosure);
            } catch (error) {
                console.log(error);
            }
        }
        if (data.Status == COMPLETED || data.Status == SURVEY) {
            $('#dvClosure').removeClass('d-none');
            $('#ctlForRequestor').html('');
            $('#ctlForRequestor').append(data['DynamicFormRequester']);
            $('#ctlForAnalyst').html('');
            $('#ctlForAnalyst').append(data['DynamicFormAnalyst']);
            $('#ctlForRequestor').removeClass('d-none');
            $('#ctlForRequestor').find('input,button,select').attr('disabled', 'disabled');
            $('#ctlForRequestor').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
            $('#ctlForAnalyst').removeClass('d-none');
            $('#ctlForAnalyst').find('input,button,select').attr('disabled', 'disabled');
            $('#ctlForAnalyst').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
        }
        //Closing section
        let isReqAnalyst = false;
        if (statusActualReq == ANALYST) {
            //Checks if logged in user is analyst or requester
            $('#dvClosure').removeClass('d-none');
            let filter = `Building eq '${building}' and Title eq '${data.Service}' and SubServicio eq '${data.Subservice}'`;
            const analistas = await GetListByQuery(url, LISTAITSERVICES, filter, '');
            //TODO: temporal, hay que leer jsn de analyst de UniversalRequest
            let aAna = analistas.d.results[0]['Email_Analista'] != null ? analistas.d.results[0]['Email_Analista'].replace(/,/, ";").split(';') : [];
            if (!isNullOrWhitespace(analistas.d.results[0]['Analista'])) {
                if (arrayOfAnalistas.length > 0) { arrayOfAnalistas = []; }
                arrayOfAnalistas.push(cleanCDSIDDomain(analistas.d.results[0]['Analista'].toString()).toUpperCase().trim());
                aAna.forEach((value) => arrayOfAnalistas.push(value.toUpperCase()));
            }
            if (creatorCDSID == userLogin) {
                isReqAnalyst = true;
                $('#dvClosure').find('textarea, button').removeAttr('disabled');
                $('#txtCommentsClosureAnalyst').attr('disabled', 'disabled');
                $('#dvBtnClosing').removeClass('d-none');
                $('#dvbtnClosedClosure').addClass('d-none');
                $('#dvbtnCancelClosure').addClass('d-none');
            } else if (arrayOfAnalistas.includes(userLogin)) {
                $('#dvClosure').find('textarea, button').removeAttr('disabled');
                $('#dvBtnClosing').removeClass('d-none');
                $('#txtCommentsClosureRequest').attr('disabled', 'disabled');
                if (isReqAnalyst) {
                    $('#dvbtnClosedClosure').removeClass('d-none');
                    $('#dvbtnCancelClosure').removeClass('d-none');
                }
            }
        }
        if (statusActualReq == CANCELLED) {
            $('#dvClosure').removeClass('d-none');
            $('#secApprover').remove();
            if ((!isNullOrWhitespace(analista) ? analista.trim() : "") == userLogin
                || (!isNullOrWhitespace(backup) ? backup.trim() : "") == userLogin) {
                $('#dvClosure').find('textarea, button').attr('disabled', 'disabled');
                $('#dvBtnClosing').addClass('d-none');
            }
        }
        let campos = "RequestID,LinkFilename,Title,Order0";
        let filtro = "RequestID eq " + item;
        try {
            const data = await GetListByIDPromise(LISTAATTACHMENTS, campos, filtro);
            let newItem = data.d.results;
            $(newItem).each(function (index, element) {
                let downloadLink = '<a href="' + url + '/' + LISTAATTACHMENTS + '/' + newItem[index].LinkFilename + '" class="btn btn-dark btn-block mb-2" style="color:#fff" target="_blank">' + newItem[index].Title + ' <i class="fa fa-download" aria-hidden="true"></i></a>';
                let file = $('input[type="file"]')[newItem[index].Order0 - 1];
                if ($(file).closest('td').length > 0) {
                    let title = '';
                    let lang = $('#ddlLanguage').val();
                    GetValueByKey('lblDownload', lang, function (data) { title = data; });
                    downloadLink = '<a href="' + url + '/' + LISTAATTACHMENTS + '/' + newItem[index].LinkFilename + '" class="btn btn-dark btn-block mb-2" style="color:#fff" target="_blank"><span data-lang="lblDownload">' + title + '</span> <i class="fa fa-download" aria-hidden="true"></i></a>';
                }
                $(file).prev('span').empty().append(downloadLink);
            });
        } catch (e) {
            console.log(e);
            return e;
        }
        //---------------------------------}

        if ($('#dynamicForm').html().includes('CUSTOM_HYPLINK')) {
            $($('#dynamicForm').html()).find('[control-type="CUSTOM_HYPLINK"]').each(function (index, element) {
                let fileURL = $(this).val();
                let urlName = $(this).next().val();
                let buttonURL;
                if (fileURL !== '' && urlName) {
                    buttonURL = `<a href="${fileURL.trim()}" class="btn btn-info btn-block mb-2" style="color:#fff" target="_blank">${urlName.trim()} <i class="fas fa-link"></i></a>`;
                } else {
                    buttonURL = `<a class="btn btn-secondary btn-block mb-2" style="color:#fff; cursor: not-allowed; opacity: 0.5;" disabled><i class="fas fa-link"></i></a>`;
                }
                $($('#dynamicForm').find('[control-type="CUSTOM_HYPLINK"]')[0]).next().remove();
                $($('#dynamicForm').find('[control-type="CUSTOM_HYPLINK"]')[0]).after(buttonURL);
                $($('#dynamicForm').find('[control-type="CUSTOM_HYPLINK"]')[0]).remove();
            })
        }
        //---------------------------------
        $('#ddlLanguage').removeAttr('disabled');
        $('#dynamicForm, #ctlForRequestor, #ctlForAnalyst').find('.form-control[disabled="disabled"]').css('color', 'slategray');
        // //TODO: experimental
        if (data.Status == COMPLETED || data.Status == SURVEY) {
            let c = getUrlParameter('c');
            let name = getUrlParameter('filename');
            if (c) {
                getPDF(name, data.Id, function (val) {
                    window.close();
                });
            }
        }
    });
}

async function GetListByIDPromise(listName, campos, filtro) {

    let path = `${url}/_api/web/lists/getbytitle('${listName}')/items`;
    if (campos != "" && campos != undefined) {
        path += "?$select=" + campos;
    }
    if (filtro != "" || filtro != undefined) {
        path += campos != "" && campos != undefined ? "&$filter=" + filtro : "?$filter=" + filtro;
    }

    try {
        const response = await fetch(path, {
            headers: {
                "accept": "application/json;odata=verbose"
            }
        });
        const data = await response.json();
        return data;
    } catch (e) {
        console.log(e);
        return e;
    }
}

async function GetPeopleName(id, control, IsObj) {

    IsObj == undefined ? IsObj = false : IsObj = IsObj;

    let user = domain + id + FORD;
    let path = `${getHostName()}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${user}'`;

    try {
        const response = await fetch(path, {
            dataType: 'json',
            headers: ACCEPT
        });
        let data = await response.json();
        data = data.d;

        if (data.DisplayName == undefined) {
            ClearReqData(control);
            let value = '';
            GetValueByKey('lblCDSIDde', Language, (v) => value = v);
            if (IsObj) {
                $(control).empty().text(value);
                $(control).addClass('text-danger').removeClass('text-info');
            }
            else {
                $('#' + control).empty().text(value);
                $(control).addClass('text-danger').removeClass('text-info');
            }
        } else {
            let name = data.DisplayName;
            if (IsObj) {
                $(control).empty().text(name);
                $(control).addClass('text-info').removeClass('text-danger');
            }
            else {
                $('#' + control).empty().text(name);
                $(control).addClass('text-info').removeClass('text-danger');
            }
        }
    } catch (e) {
        console.log(e);
        return e;
    }
}

function AddRequest(t) {

    let tabla = $(t).closest('table');
    let fila = GetNewRow();
    $(tabla).find('tbody').append(fila);
    if ($(tabla).find('tbody tr').length >= 2 && $(tabla).find('thead tr th').length == 5) {
        $(tabla).find('thead tr').append('<th>');
        $(tabla).find('tfoot tr td').attr('colspan', '6');
    }
    $('.field-required').on('blur change', function () {
        $(this).removeClass('is-valid');
        $(this).removeClass('is-invalid');
        if ($(this).val() == "" || $(this).val() == undefined) {
            $(this).addClass('is-invalid');
        } else {
            $(this).addClass('is-valid');
        }
    });
}

function GetNewRow() {

    let result = '<tr>';

    result += '<td><input type="text" class="form-control txtRequest text-uppercase field-required" onblur="ChangeCDSID(this)"><span class="text-info"></span></td>';
    result += '<td><span class="text-info" ></span></td>';
    result += '<td><span class="text-info" ></span></td>';
    result += '<td><span class="text-info" ></span></td>';
    result += '<td><span class="text-info" ></span></td>';
    result += '<td><button onclick="DeleteRow(this); return false" class="btn btn-danger btn-sm">DELETE <i class="fas fa-trash fa-sm  "></i></button></td>';

    result += '</tr>';
    return result;

}

function DeleteRow(t) {
    let tabla = $(t).closest('table');

    $(t).closest('tr').remove();
    if ($(tabla).find('thead tr th').length > 5) {
        $(tabla).find('thead tr th:last').remove();
    }
    console.log('arrayApprovalsNull ', arrayApprovalsNull);
    if (arrayApprovalsNull.length > 0) {
        lastRequestor();
    }

    $('[id^="txtApproval"]').each(function () {
        $(this).blur();
    });
}

//------------------------------------------------
// Retrieve all locations from filtering a list
//------------------------------------------------
async function LoadLocations() {

    let path = `${url}/_api/web/lists/getbytitle('${LISTACATALOGOF}')/items?$top=5000`;

    try {
        const response = await fetch(path, {
            headers: ACCEPT
        });
        const data = await response.json();

        let BuildingName = [];
        let BuildingCode = [];
        let lang = $('#ddlLanguage').val();
        let textSelect;

        // gets the text according to the language bassed on the key
        GetValueByKey('optSelectText', lang, (val) => textSelect = val);

        // creates a string with the first default option
        let options = '<option selected disabled hidden>' + textSelect + '</option>';

        for (let i = 0; i < data.d.results.length; i++) {
            if (data.d.results[i].BuildingName !== null && data.d.results[i].Building !== null) {
                // validates if theres a building name and value in the array of buildings
                if (!BuildingName.includes((data.d.results[i].BuildingName).trim()) && !BuildingCode.includes((data.d.results[i].Building).trim())) {
                    BuildingName.push((data.d.results[i].BuildingName).trim());
                    BuildingCode.push((data.d.results[i].Building).trim());
                    options += '<option value="' + data.d.results[i].Building + '">' + data.d.results[i].Building + '-' + data.d.results[i].BuildingName + '</option>';
                }
            }
        }

        // add the new options to the select input
        $('#ddBuilding').append(options);
        loadInputByParameter('ddBuilding', 'location', getUserProperty('FordBuildingNo'));
    } catch (e) {
        alert('Error on load locations');
        return e;
    }
}

function SelectHasValue(select, value) {
    obj = document.getElementById(select);

    if (obj !== null) {
        return (obj.innerHTML.indexOf('value="' + value + '"') > -1);
    }
    else {
        return false;
    }
}

//get buildings to show in form
function GetBuildings(items, propertyName) {
    let result = [];
    let newA = [];
    $.each(items, function (index, item) {
        let obj = {
            "Building": item[propertyName],
            "BuildingName": item[propertyName] + "-" + item["BuildingName"],
        };
        if ($.inArray(item[propertyName], result) == -1) {
            result.push(item[propertyName]);
            newA.push(obj);
        }
    });
    return newA;
}

//save new requests
async function SaveRequest() {

    //TODO: REFACTOR
    try {

        let reqCDSID = '';
        let reportsTo = '';
        let lang = $('#ddlLanguage option:selected').val().trim();

        $('#tblRequester').find('tbody tr').each(function () {
            reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
            reportsTo += $(this).find('td:eq(3) span').text().toUpperCase() + ";";
        });

        let json = cleanCDSIDDomain(GetJSONApprovals(1));
        let jsonAnalysts = cleanCDSIDDomain(GetJSONAnalysts());

        let estatus = 'Approval1';
        if (JSON.parse(json).length == 0) {
            estatus = 'Analyst';
        }


        if ($('#lblStatus').text() == REJECTED) {
            //#region MERGE
            let obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "RequestDate": new Date(),
                "Status": estatus,
                "RequestCDSID": reqCDSID,
                "LocationID": $('#ddBuilding option:selected').text(),
                "Service": $('#ddArea').val(),
                "Subservice": $('#ddRequestType').val(),
                "Justification": $('#txtDescriptionJustify').val(),
                "Approvals": json,
                "Analysts": jsonAnalysts,
                "DynamicForm": $('#dynamicForm').prop('outerHTML'),
                "LanguageCode": $('#ddlLanguage').val(),
                "Survey": "",
                "CreatorCDSID": userLogin,
                "CreatorName": displayName.toString()
            };

            let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${$('#currentRequestId').val()})`;

            try {
                const response = await fetch(path, {
                    method: 'POST',
                    contentType: 'application/json;odata=verbose',
                    data: JSON.stringify(obj),
                    headers: {
                        "Accept": "application/json;odata=verbose",
                        "X-RequestDigest": getExternalDigestValue(url),
                        "X-HTTP-Method": "MERGE",
                        "If-Match": "*"
                    }
                });
                const data = await response.json();

                let currentId = $('#currentRequestId').val();
                uploadFiles(currentId);

                let createdBy = userLogin;
                CreateLOG(currentId, createdBy, PHASE.RESEND, null);

                //notification
                let analyst;
                let CC;
                if (estatus == 'Analyst') {
                    analyst = $('#lblResponsableAsignado').text();
                    analyst = analyst.replace("(", "").replace(")", "").trim();
                    backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                    CC = backupAnalyst.split(';');
                    if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                    sendNotification(analyst, CC, estatus, $('#ddRequestType').val(), currentId, lang);
                } else {
                    //Notification
                    //if it is random approval flow,then send notification to all approvers
                    //if is secuential, just send to first approver
                    let objApp = JSON.parse(json);
                    let isSecuential = objApp.filter(value => value.ApprovalOrder != 1).length > 0;
                    if (isSecuential || objApp.length == 1) {
                        let app = JSON.parse(json)[0].Approval;
                        let CC = reqCDSID.split(';');
                        CC = CC.filter(function (value) {
                            return value != "";
                        });
                        let emailApp = app.replace(/'/g, ';').split(';')[0];
                        sendNotification(emailApp, CC, 'Approval1', $('#ddRequestType').val(), currentId, lang);
                    } else {
                        //Random approval flow
                        let approvers = objApp.map(value => value.Approval);
                        approvers.forEach((value) => {
                            let app = value;
                            let emailApp = app.replace(/'/g, ';').split(';')[0];
                            sendNotification(emailApp, [], 'Approvals', $('#ddRequestType').val(), currentId, lang);
                        });
                    }
                }
                let idRequest = (data !== undefined) ? data.d.Id : $('#lblID').html();

                let msj = '<div class="alert alert-success" role="alert">';
                msj += '<h4 class="alert-heading"><span data-lang="MsjSuccess"></span></h4>';
                msj += '<p data-lang="RqstSend"></p>';
                //bloques
                let backTxt = '';
                GetValueByKey('lblbackText', $('#ddlLanguage').val(), (val) => backTxt = val);
                msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + '&num=' + idRequest + '" class="btn btn-primary" style="color:white">' + backTxt + '</a>';
                //--------
                msj += '</div>';

                let folio = '<span>' + currentId + '</span>';
                $('#main').remove();
                $('#GeneralMsj').append(msj);
                loadLang(lang);

                $('p[data-lang="RqstSend"]').append(folio);
            } catch (e) {
                console.log(e);
                return e;
            }
            //#endregion
        } else {
            //#region POST

            let obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "RequestDate": new Date(),
                "Status": estatus,
                "RequestCDSID": reqCDSID,
                "LocationID": $('#ddBuilding option:selected').text(),
                "Service": $('#ddArea').val(),
                "Subservice": $('#ddRequestType').val(),
                "Justification": $('#txtDescriptionJustify').val(),
                "Approvals": json,
                "Analysts": jsonAnalysts,
                "Log": "",
                "DynamicForm": $('#dynamicForm').prop('outerHTML'),
                "LanguageCode": $('#ddlLanguage').val(),
                "Survey": "",
                "CreatorCDSID": userLogin,
                "CreatorName": displayName.toString()
            };

            let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items`;

            try {
                const response = await fetch(path, {
                    method: 'POST',
                    contentType: 'application/json;odata=verbose',
                    body: JSON.stringify(obj),
                    headers: POST
                });
                const data = await response.json();
                console.log(data);
                let requestID = data.d.Id;

                //TODO: change path to PRD environment
                let newURL = `${location.protocol}//${location.host}${location.pathname}?SiteCode=${SiteCode}&num=${data.d.Id}`;
                newURL = `<a href="${newURL}" target="_blank">${data.d.Id}</a>`;
                let element = {
                    "__metadata": {
                        "type": "SP.Data.UniversalRequestListItem"
                    },
                    "Link": newURL
                };

                let pathM = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${data.d.Id})`;
                try {
                    // let digestM = await getExternalDigestValue(url);
                    // MERGE["X-RequestDigest"] = digest;
                    const responseM = await fetch(pathM, {
                        method: 'POST',
                        contentType: 'application/json;odata=verbose',
                        body: JSON.stringify(element),
                        headers: MERGE
                    });
                    console.log('success');
                    let createdBy = userLogin;
                    let lang = $('#ddlLanguage option:selected').val().trim();
                    CreateLOG(requestID, createdBy, PHASE.SEND);
                } catch (e) {
                    console.log(e);
                    return e;
                }

                uploadFiles(requestID);
                //notification

                let objApp = JSON.parse(json);
                let isSecuential = objApp.filter(value => value.ApprovalOrder != 1).length > 0;

                if (estatus == ANALYST) {
                    //notification
                    let analyst;
                    let CC = [];
                    analyst = $('#lblResponsableAsignado').text();
                    analyst = analyst.replace("(", "").replace(")", "").trim();
                    backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                    CC = backupAnalyst.split(';');
                    if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                    sendNotification(analyst, CC, estatus, $('#ddRequestType').val(), data.d.Id, lang);

                } else {
                    if (isSecuential || objApp.length == 1) {
                        let app = JSON.parse(json)[0].Approval;
                        let CC = reqCDSID.split(';');

                        CC = CC.filter(function (value) {
                            return value != "";
                        });

                        //--------------------------------------------------
                        // mejora bloques de aprobadores
                        //--------------------------------------------------
                        let appLevels = {};
                        let _TO;
                        let _CC;

                        let emailInfo = {
                            currentLvl: 0,
                            TO: [],
                            CC: []
                        };

                        let approvals = JSON.parse(json);
                        let _requestors = [];

                        $('#tblRequester').find('tbody tr').each(function () {
                            _requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                        });

                        if (objApp.length > 1) {

                            $.each(approvals, function (index, element) {
                                if (element.Date == null && emailInfo.currentLvl == 0) { emailInfo.currentLvl = element.ApprovalOrder; return null; }
                            });

                            $.each(approvals, function (index, element) {
                                if (element.ApprovalOrder == emailInfo.currentLvl && element.Date == null) {
                                    emailInfo.TO.push(element.Approval.split(';')[0]);
                                    const _approvers = element.Approval.split(';');
                                    _approvers.shift();
                                    if (_approvers.length > 0) {
                                        const tempArray = emailInfo.CC.concat(_approvers);
                                        emailInfo.CC = tempArray;
                                    }
                                }
                            });


                        } else {
                            emailInfo.CC = CC;
                            emailInfo.TO = app.replace(/'/g, ';').split(';');
                        }

                        const addRequestors = emailInfo.CC.concat(_requestors);
                        emailInfo.CC = addRequestors;
                        //--------------------------------------------------

                        sendNotification(emailInfo.TO, emailInfo.CC, 'Approval1', data.d.Subservice, data.d.Id, lang);

                    } else {
                        let _requestors = [];

                        $('#tblRequester').find('tbody tr').each(function () {
                            _requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                        });

                        let approvers = objApp.map(value => value.Approval);
                        approvers.forEach((value) => {
                            let app = value;
                            let emailApp = app.replace(/'/g, ';').split(';')[0];
                            sendNotification(emailApp, _requestors, 'Approvals', data.d.Subservice, data.d.Id, lang);
                        });

                        //SE AGREGA CORREO PARA LOS ANALISTAS
                        let analyst;
                        let CC = [];
                        analyst = $('#lblResponsableAsignado').text();
                        analyst = analyst.replace("(", "").replace(")", "").trim();
                        backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                        CC = backupAnalyst.split(';');
                        if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };

                        let _appObj = objApp.filter(function (approver) {
                            return approver.Date == null;
                        });
                        if (_appObj.length < 1) sendNotification(analyst, CC, 'Analyst', $('#ddRequestType').val(), data.d.Id, lang);
                    }
                }

                //get button text from language
                let backText = '';
                GetValueByKey('lblbackText', lang, (val) => backText = val);

                let msj = '<div class="alert alert-success" role="alert">';

                msj += '<h4 class="alert-heading"><span data-lang="MsjSuccess"></span></h4>';
                msj += '<p data-lang="RqstCreate"></p>';
                msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + '&num=' + data.d.Id + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
                msj += '</div>';
                let folio = '<span>' + data.d.Id + '</span>';


                $('#main').remove();
                $('#GeneralMsj').append(msj);
                loadLang(lang);

                $('p[data-lang="RqstCreate"]').append(folio);

            } catch (e) {
                console.log(e);
                return e;
            }

            try {
                let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items`;
                const response = await fetch(path, {
                    method: 'POST',
                    contentType: 'application/json;odata=verbose',
                    body: JSON.stringify(obj),
                    headers: POST
                });
                const data = await response.json();
                console.log(data);

                let requestID = data.d.Id;

                //TODO: change path to PRD environment
                let newURL = `${location.protocol}//${location.host}${location.pathname}?SiteCode=${SiteCode}&num=${data.d.Id}`;
                newURL = `<a href="${newURL}" target="_blank">${data.d.Id}</a>`;
                let element = {
                    "__metadata": {
                        "type": "SP.Data.UniversalRequestListItem"
                    },
                    "Link": newURL
                };
                try {
                    let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${data.d.Id})`;
                    const responseM = await fetch(path, {
                        method: 'POST',
                        contentType: 'application/json;odata=verbose',
                        body: JSON.stringify(element),
                        headers: MERGE
                    });
                    // const dataM = await responseM.json();

                    console.log('success');
                    let createdBy = userLogin;
                    // let lang = $('#ddlLanguage option:selected').val().trim();
                    CreateLOG(requestID, createdBy, PHASE.SEND);
                } catch (e) {
                    console.log(e);
                    return e;
                }
                uploadFiles(requestID);
                //notification
                let objApp = JSON.parse(json);
                let isSecuential = objApp.filter(value => value.ApprovalOrder != 1).length > 0;
                if (estatus == ANALYST) {
                    //notification
                    let analyst;
                    let CC = [];
                    analyst = $('#lblResponsableAsignado').text();
                    analyst = analyst.replace("(", "").replace(")", "").trim();
                    backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                    CC = backupAnalyst.split(';');
                    if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                    sendNotification(analyst, CC, estatus, $('#ddRequestType').val(), data.d.Id, lang);
                } else {
                    if (isSecuential || objApp.length == 1) {
                        let app = JSON.parse(json)[0].Approval;
                        let CC = reqCDSID.split(';');
                        CC = CC.filter(function (value) {
                            return value != "";
                        });
                        //--------------------------------------------------
                        // mejora bloques de aprobadores
                        //--------------------------------------------------
                        let appLevels = {};
                        let _TO;
                        let _CC;
                        let emailInfo = {
                            currentLvl: 0,
                            TO: [],
                            CC: []
                        };
                        let approvals = JSON.parse(json);
                        let _requestors = [];
                        $('#tblRequester').find('tbody tr').each(function () {
                            _requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                        });
                        if (objApp.length > 1) {
                            $.each(approvals, function (index, element) {
                                if (element.Date == null && emailInfo.currentLvl == 0) { emailInfo.currentLvl = element.ApprovalOrder; return null; }
                            });
                            $.each(approvals, function (index, element) {
                                if (element.ApprovalOrder == emailInfo.currentLvl && element.Date == null) {
                                    emailInfo.TO.push(element.Approval.split(';')[0]);
                                    const _approvers = element.Approval.split(';');
                                    _approvers.shift();
                                    if (_approvers.length > 0) {
                                        const tempArray = emailInfo.CC.concat(_approvers);
                                        emailInfo.CC = tempArray;
                                    }
                                }
                            });
                        } else {
                            emailInfo.CC = CC;
                            emailInfo.TO = app.replace(/'/g, ';').split(';');
                        }
                        const addRequestors = emailInfo.CC.concat(_requestors);
                        emailInfo.CC = addRequestors;
                        //--------------------------------------------------
                        sendNotification(emailInfo.TO, emailInfo.CC, 'Approval1', data.d.Subservice, data.d.Id, lang);
                    } else {
                        let _requestors = [];
                        $('#tblRequester').find('tbody tr').each(function () {
                            _requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                        });
                        let approvers = objApp.map(value => value.Approval);
                        approvers.forEach((value) => {
                            let app = value;
                            let emailApp = app.replace(/'/g, ';').split(';')[0];
                            sendNotification(emailApp, _requestors, 'Approvals', data.d.Subservice, data.d.Id, lang);
                        });
                        //SE AGREGA CORREO PARA LOS ANALISTAS
                        let analyst;
                        let CC = [];
                        analyst = $('#lblResponsableAsignado').text();
                        analyst = analyst.replace("(", "").replace(")", "").trim();
                        backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                        CC = backupAnalyst.split(';');
                        if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                        let _appObj = objApp.filter(function (approver) {
                            return approver.Date == null;
                        });
                        if (_appObj.length < 1) sendNotification(analyst, CC, 'Analyst', $('#ddRequestType').val(), data.d.Id, lang);
                    }
                }
                //get button text from language
                let backText = '';
                GetValueByKey('lblbackText', lang, (val) => backText = val);
                let msj = '<div class="alert alert-success" role="alert">';
                msj += '<h4 class="alert-heading"><span data-lang="MsjSuccess"></span></h4>';
                msj += '<p data-lang="RqstCreate"></p>';
                msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + '&num=' + data.d.Id + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
                msj += '</div>';
                let folio = '<span>' + data.d.Id + '</span>';
                $('#main').remove();
                $('#GeneralMsj').append(msj);
                loadLang(lang);
                $('p[data-lang="RqstCreate"]').append(folio);

            } catch (e) {
                console.log(e);
                return e;
            }
            // #endregion
        }
    } catch (e) {
        console.log(e);
        return e;
    }
}

//return JSON of approvals depending in mode
function GetJSONApprovals(mode) {

    let json;
    let arrayOfJSON = new Array();

    try {

        if (mode == 1) {
            let i = 1;
            $('[id^="txtApproval"]').each(function (index, element) {

                let config = JSON.parse($('#txtApproval' + i).data('config'));
                let nombre = $(this).next('span').html();
                let appAll = config.Approval;
                let CDSID = $(this).val();


                if (!isNullOrWhitespace(config.ApprovalCDSID)) {
                    appAll = config.ApprovalCDSID.replace(/,/g, ";")
                    appAll = appAll.replace(CDSID, '');
                    appAll = appAll.replace(/;;/g, ";").replace(/;;;/g, ';');;
                }
                else {
                    if (!isNullOrWhitespace(config.Approval)) {
                        appAll = config.Approval.replace(/,/g, ";");
                        appAll = appAll.replace(CDSID, '');
                        appAll = appAll.replace(/;;/g, ";").replace(/;;;/g, ';');
                    }
                    else if (!isNullOrWhitespace(CDSID)) {
                        appAll = CDSID;
                        appAll = appAll.replace(CDSID, '');
                        appAll = appAll.replace(/;;/g, ";").replace(/;;;/g, ';');
                    }
                }
                if (appAll.split(";").length > 1) { appAll = CDSID + ";" + appAll; } else { appAll = CDSID; }
                CDSID = appAll.replace(/;;/g, ";").replace(/;;;/g, ';');

                let title = config.ApprovalTitle;
                if (title == undefined) {
                    title = config.Title;
                }

                if (!isNullOrWhitespace(CDSID)) {
                    json = new Approval(title, CDSID.toUpperCase(), nombre, null, null, config.ApprovalOrder, config.MustBeLL6);
                    arrayOfJSON.push(json);
                }
                i++;
            });
        }

        return JSON.stringify(arrayOfJSON);

    } catch (error) {
        console.log(error);
    }
}

function UpdateJSONApprovals() {

    try {

        let jsonOriginal = [];
        let table = $('#approvalsSection').find('table');
        $(table).find('tbody tr').each(function (index, value) {
            let data = JSON.parse($(this).find('td:eq(1) input').data('config'));
            let nombre = $(this).find('td:eq(1) input').next('span').html();
            let newApp = $(this).find('td:eq(1) input').val().toUpperCase();
            jsonOriginal.push(new Approval(data.Title, newApp, nombre, data.Date, data.Comments, data.ApprovalOrder, data.MustBeLL6OrMore));
        });

        return JSON.stringify(jsonOriginal);

    } catch (error) {
        alert(JSON.stringify(error));
    }

}

function GetJSONAnalysts() {

    let json;
    let arrayOfJSON = new Array();
    let analyst;
    let backupAnalyst;

    try {
        if (arrayAdministrators.indexOf(userLogin) >= 0 && $('#currentRequestId').val() != "0") {
            analyst = $('#txtResponsableAsignado').val();
            backupAnalyst = $('#lblAnalistasAsignados').text();
        }
        else {
            analyst = $('#lblResponsableAsignado').text();
            analyst = analyst.replace("(", "").replace(")", "").trim();
            backupAnalyst = $('#lblAnalistasAsignados').text();
        }

        json = new Analyst(isNullOrWhitespace(analyst) ? "" : analyst.toUpperCase(), isNullOrWhitespace(backupAnalyst) ? "" : backupAnalyst.toUpperCase());
        arrayOfJSON.push(json);

        return JSON.stringify(arrayOfJSON);

    } catch (error) {
        console.log(error);
    }
}

//people, option, requestID, aditionalInfo
//Creates LOG for any phase
async function CreateLOG(requestID, requester, phase, comments, usertype) {
    try {
        let historico = "";
        let log = "";

        GetValueByKey(`log${phase}`, Language, function (data) { log = data });

        log = log.replace(/\[user\]/g, requester);
        log = log.replace(/\[date\]/g, new Date().toLocaleString());
        log = log.replace(/\[comments\]/g, comments);
        log = log.replace(/\[usertype\]/g, usertype);

        if (!isNullOrWhitespace(requestID)) {
            const data = await GetListByID(url, LISTAUNIVERSALREQUEST, requestID);
            console.log(data);
            historico = isNullOrWhitespace(data.Log) ? "" : data.Log;
            historico += "\n" + log;
            obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "Log": historico
            };
            let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
            const response = await fetch(path, {
                method: 'POST',
                contentType: "application/json;odata=verbose",
                body: JSON.stringify(obj),
                headers: MERGE
            });
            await response.json();
        }
    } catch (error) {
        console.log('error: ', error);
    }
}

async function sendNotification(people, cc, status, service, id, lang) {

    let statusSend;

    if (people.indexOf(',') > -1) { if (people.substring(0, 1) == ",") { people = people.substring(1, people.length); } }

    // mejora de bloques
    if (typeof people == 'object') {
        people = JSON.stringify(people).replace('[', '').replace(']', '');

        while (people.includes('"')) {
            people = people.replace('"', '');
        }
    }

    let TO = cleanArray(people.replace(/,/g, ";").split(';'), "");
    let CC = cc

    let num = getUrlParameter('num');
    num = (num !== undefined) ? '&num=' + num : '';

    TO = AddDomain(TO);
    CC = AddDomain(CC);

    if (status.indexOf('Approval') == -1)
        statusSend = status
    else
        statusSend = 'Approval';

    try {
        let subject = "";
        let mensaje = "";

        let host = getHostName() + url;
        let ids = id;

        GetValueByKey("Sts" + statusSend + "Subject", lang, function (data) { subject = data; });
        GetValueByKey("Sts" + statusSend + "Body", lang, function (data) { mensaje = data; });

        subject = subject.replace(/\(service\)/g, "( " + service + " )").replace('\r', '').replace('\n', '');
        subject = subject.replace(/\[id\]/g, ids);

        mensaje = mensaje.replace(/\<b\>service\<\/b\>/g, "<b>" + service + "</b>");

        let inicio = mensaje.indexOf('[host]');
        let fin = mensaje.indexOf('[id]');

        let urlSiteCode = '?SiteCode=' + SiteCode;
        mensaje = mensaje.replace(mensaje.substring(inicio, fin), location.protocol + '//' + location.host + location.pathname + urlSiteCode + num);

        if (getUrlParameter('num') === undefined) {
            mensaje = mensaje.replace(/\[id\]/g, '&num=' + ids);
        }
        else {
            mensaje = mensaje.replace(/\[id\]/g, '');
        }

        if (status == "Approval1" || status == "Approvals" || status == "New Request") {
            let fields = "ID";
            let filter = "Status eq 'Completed' or Status eq 'Survey'";
            let length = 0;
            let pounds = 0;
            let wood_use = 0;
            let total_energy = 0;
            let ghg = 0;
            let water_usage = 0;
            let solid_waste = 0;
            let lang = $('#ddlLanguage').val();

            const data = await GetListByQuery(url, LISTAUNIVERSALREQUEST, filter, fields);

            length = data.d.results.length;

            //Calcs for environmental impact notification
            pounds = ((((length / 500) / 10) / 40) * 2000);
            wood_use = pounds / 501;
            total_energy = pounds / 79;
            ghg = pounds / 0.12;
            water_usage = pounds / 0.09;
            solid_waste = pounds / 1.70;

            let ret_message = '';
            GetValueByKey('msjEnvironmentalImpact', lang, function (data) { ret_message = data });

            ret_message = ret_message.replace(/\{wood_use\}/g, wood_use.toFixed(4));
            ret_message = ret_message.replace(/\{total_energy\}/g, total_energy.toFixed(4));
            ret_message = ret_message.replace(/\{ghg\}/g, ghg.toFixed(4));
            ret_message = ret_message.replace(/\{water_usage\}/g, water_usage.toFixed(4));
            ret_message = ret_message.replace(/\{solid_waste\}/g, solid_waste.toFixed(4));

            mensaje += `<br><br><br><br>${ret_message}`;

            sendEmail("", TO, template(mensaje, people.toString().toUpperCase(), lang), CC, subject);
        }

        else {
            sendEmail("", TO, template(mensaje, people.toString().toUpperCase(), lang), CC, subject);
        }

    } catch (error) {
        console.log('error (notification): ', error);
    }

}

function Approval(title, id, name, date, comments, order, LL6OrMore) {
    this.ApprovalOrder = order;
    this.Title = title;
    this.Approval = id;
    this.Name = name;
    this.Date = date;
    this.Comments = comments;
    this.MustBeLL6OrMore = LL6OrMore;
}

function Closure(commentsReq, commentsAnalyst, date) {
    this.CommentsRequest = commentsReq;
    this.CommentsAnalyst = commentsAnalyst;
    this.Date = date;
}
function Analyst(analyst, backup) {
    this.analyst = analyst;
    this.backup = backup;
}

//#region Template email
function template(msj, TO, lang) {

    let path = url + "/Tools/images/";
    let result = '';

    result += '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';
    result += '<html xmlns="http://www.w3.org/1999/xhtml">';
    result += '<head>';
    result += '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />';
    result += '<title>Mobile Team Ford</title>';
    result += '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>';
    result += '</head>';

    result += '<body style="margin: 0; padding: 0;">';
    result += '<table border="0" cellpadding="0" cellspacing="0" width="100%">';
    result += '<tr>';
    result += '<td style="padding: 10px 0 30px 0;">';
    result += '<table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border: 1px solid #cccccc; border-collapse: collapse;">';
    result += '<tr>';
    result += '<td align="center" bgcolor="#70bbd9" style="padding: 40px 0 30px 0; color: #153643; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif;">';
    result += '<img src="' + path + 'Ford-Oval-large.png" alt="FORD MOTOR COMPANY" style="display: block; width: 200px;" /><br>';
    result += 'Mobile Universal Request 4 (MUR4)';
    result += '</td>';
    result += '</tr>';
    result += '<tr>';
    result += '<td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">';
    result += '<table border="0" cellpadding="0" cellspacing="0" width="100%">';
    result += '<tr>';
    result += '<td style="color: #153643; font-family: Arial, sans-serif; font-size: 24px;">';

    let saludo = '';
    GetValueByKey("MsjHeadMail", lang, function (d) { saludo = d; });

    result += '<b>' + saludo + ' ' + TO + '</b>';
    result += '</td>';
    result += '</tr>';

    result += '<tr>';
    result += '<td align="left" bgcolor="#fff" style="padding: 40px 0 30px 0; color: #153643; font-size: 14px; font-weight: normal; font-family: Arial, sans-serif;">';
    result += msj;
    result += '<br><br><br></td>';
    result += '</tr></table></td></tr>';

    let foot = '';
    GetValueByKey("MsjFootMail", lang, function (d) { foot = d; });

    result += '<tr>';
    result += '<td bgcolor="#70bbd9">';
    result += '<table border="0" cellpadding="0" cellspacing="0" width="100%">';
    result += '<tr>';
    result += '<td style="color: #000; font-family: Arial, sans-serif; font-size: 14px; padding:10px; text-align:right;" width="100%">';
    result += foot;
    result += ' MUR4 Team';
    result += '</td></tr>';

    result += '</table>'
    result += '</td>';
    result += '</tr>';
    result += '</table>';
    result += '</td>';
    result += '</tr>';
    result += '</table>';
    result += '</body>';
    result += '</html>';

    return result;
}
//#endregion


//#region Dynamic form
function GetSections(items, propertyName) {
    let result = [];
    let obj = [];
    $.each(items, function (index, item) {
        if ($.inArray(item[propertyName], result) == -1) {
            result.push(item[propertyName]);
            obj.push(item);
        }
    });
    return obj;
}

function GetElementsByPropValue(items, propertyName, value) {
    let obj = [];
    $.each(items, function (index, item) {
        if (item[propertyName] == value) {
            obj.push(item);
        }
    });
    return obj;
}

function GetUniquesValues(items, propertyName) {
    let result = [];
    $.each(items, function (index, item) {
        if ($.inArray(item[propertyName], result) == -1) {
            result.push(item[propertyName]);
        }
    });
    return result;
}

//Load all controls dinamically depending of the CatalogodeFunciones_v2 data
async function LoadForm(building, service, isAnalyst = false) {

    let filtro = `Building eq '${building}' and Title eq '${service}'&$top=500`;
    let select = "ID,Building,Title,Reqst_Title,Funcion,Columna,RTControlType,DDOptions,Order0,Section,SectionTitle,SectionField,ControlFor,IsRequired,RowNumber,ColumnPosition,Colspan,AttachFormat,AttachSize,DependsOn,FillTo";

    let td;
    const obj = await GetListByQuery(url, LISTACATALOGOF, filtro, select);

    let ctls;
    let ctlRequest = obj.d.results.filter((value) => {
        return value["SectionField"] == "Request" || value["SectionField"] == "" || value["SectionField"] == undefined;
    });
    let ctlAnalyst = obj.d.results.filter((value) => {
        return value["SectionField"] == "Post Approval Section";
    });
    //COLOCA EL NOMBRE A LA SECCION DE ANALISTA O SOLICITANTE
    let AnalystsConfig = false;
    let RequestConfig = false;
    obj.d.results.filter((value) => {
        if (value["SectionField"] == "Post Approval Section" && value["ControlFor"] == "Analysts") {
            if (!isNullOrWhitespace(value["SectionTitle"])) {
                $("#lblAnalystSection").html(value["SectionTitle"]);
                $('#hlblAnalystSection').val(value["SectionTitle"]);
            }
        }
        if (value["SectionField"] == "Post Approval Section" && value["ControlFor"] == "Requestor") {
            if (!isNullOrWhitespace(value["SectionTitle"])) {
                $("#lblRequestSection").html(value["SectionTitle"]);
                $('#hlblRequestSection').val(value["SectionTitle"]);
            }
        }
    });
    //Checks if controls will be for analyst or requestor
    let secciones;
    if (isAnalyst) {
        secciones = GetSections(ctlAnalyst, 'Section');
        secciones = secciones.sort(compareValues("Section"));
        ctls = ctlAnalyst;
    } else {
        secciones = GetSections(ctlRequest, 'Section');
        secciones = secciones.sort(compareValues("Section"));
        ctls = ctlRequest;
    }
    let fila;
    let cdsid = [];
    let savedProps = {};
    $(secciones).each(function (index, element) {
        let section = $.parseHTML(GetNewSection(element.SectionTitle))
        let controls = GetElementsByPropValue(ctls, "Section", element.Section);
        controls.sort(function (a, b) {
            return parseFloat(a.Order0) - parseFloat(b.Order0);
        });
        //rownumber
        let rows = GetUniquesValues(controls, "RowNumber");
        rows = rows.sort(function (a, b) { return a - b });
        let isRep = false;
        let isCtl = false;
        let isRow = false;
        let ctlForAnalyst;
        $(rows).each(function (index, element) {
            fila = $.parseHTML('<div class="form-group row"></div>');
            let items = GetElementsByPropValue(controls, "RowNumber", element);
            items = items.sort(compareValues("ColumnPosition"));
            let controlType;
            let colspan;
            let md;
            let columna;
            let nc;
            controlType = items.filter(isREPTABLE);
            if (controlType.length > 0 && !isRep) {
                isRep = true;
                let col = controlType[0].Colspan;
                colspan = parseInt(col != "" && col != undefined ? col : 1);
                md = 3 * colspan;
                columna = $.parseHTML('<div class="col-md-' + md + ' table-responsive"></div>');
                $(columna).append(GetREPTABLE(controlType));
                ctlForAnalyst = controlType[0]['ControlFor'] == 'Analysts';
            }
            controlType = items.filter(GetControls);
            let flag = '';
            if (controlType.length > 0) {
                let _controls = {};
                $(controlType).each(function (index, element) {
                    colspan = parseInt(element.Colspan != "" && element.Colspan != undefined ? element.Colspan : 1);
                    md = 3 * colspan;
                    ctlForAnalyst = element['ControlFor'] == 'Analysts';
                    let vColumna = ""
                    if (!isNullOrWhitespace(element.Columna)) { vColumna = element.Columna.toUpperCase(); }
                    switch (vColumna) {
                        case 'TEXT'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            nc = $.parseHTML(GetTEXT(element.ID, element.Reqst_Title, element.IsRequired));
                            $(columna).append(nc);
                            break;
                        case 'DropDown'.toUpperCase():
                            if (flag != element.Reqst_Title) {
                                columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                                let valores = GetValues(controlType, element.Reqst_Title);
                                valores = valores.sort(compareValues('Order0'));
                                nc = GetDD(element.ID, element.Reqst_Title, valores, element.DependsOn, element.FillTo, element.IsRequired);
                                $(columna).append(nc);
                            }
                            flag = element.Reqst_Title;
                            break;
                        case 'HypLink'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            nc = $.parseHTML(GetHypLink(element.Funcion, element.Reqst_Title));
                            $(columna).append(nc);
                            break;
                        case 'List'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            nc = $.parseHTML(element.Funcion);
                            $(columna).append(nc);
                            break;
                        case 'CHBX'.toUpperCase():
                            //checkbox por grupos
                            if (flag != element.Reqst_Title) {
                                let arrCB = isCheckBox(items, element.Reqst_Title);
                                if (arrCB.length > 0) {
                                    let col = arrCB[0].Colspan;
                                    colspan = parseInt(col != "" && col != undefined ? col : 1);
                                    md = 3 * colspan;
                                    columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                                    $(columna).append($.parseHTML(GetCheckBOX(arrCB)));
                                }
                                flag = element.Reqst_Title;
                            }
                            break;
                        case 'Date'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            let id = element.Reqst_Title.replace(/:/g, '');
                            id = id.replace(/ /g, '');
                            id = id + '_' + Math.random().toString().substr(2, 6);
                            nc = $.parseHTML(GetDate(id, element.Funcion, element.IsRequired));
                            let order = element.Order0;
                            let control = $(nc)[1];
                            if (order != "" && order != undefined) {
                                let days = order.split('-');
                                if (days.length > 0) {
                                    days = days[1];
                                    if (!isNullOrWhitespace(element.FillTo)) {
                                        let fill = element.FillTo.replace(/:/g, '');
                                        fill = fill.replace(/ /g, '');
                                        $(control).attr('onchange', 'SetMaxDate("' + id + '","' + fill + '_")');
                                        savedProps[element.FillTo] = days;
                                    } else if (!isNullOrWhitespace(element.DependsOn)) {
                                        $(control).attr('data-days', days);
                                        if (savedProps[element.Reqst_Title] !== undefined) {
                                            let startDays = savedProps[element.Reqst_Title];
                                            $(control).attr('data-days-min', startDays);
                                        }
                                    } else if (!isNaN(days) && days > 0) {
                                        $(control).datepicker({ dateFormat: 'MM dd yy', maxDate: days, changeYear: true, changeMonth: true });
                                    }
                                }
                            }
                            $(columna).append(nc);
                            break;
                        case 'RADIO'.toUpperCase():
                            if (flag != element.Reqst_Title) {
                                let arrRB = items.filter(isRadioButton);
                                if (arrRB.length > 0) {
                                    for (let r = 0; r < arrRB.length; r++) {
                                        GetRadioButton(arrRB[_controls.radio]);
                                    }
                                    columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                                    let col = arrRB[0].Colspan;
                                    colspan = parseInt(col != "" && col != undefined ? col : 1);
                                    md = 3 * colspan;
                                    columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                                    $(columna).append($.parseHTML(GetRadioButton(arrRB)));
                                }
                            }
                            flag = element.Reqst_Title;
                            break;
                        case 'Attach'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            let aID_A = Math.random().toString().substr(2, 6);
                            nc = $.parseHTML(GetAttach(aID_A, element.Reqst_Title, element.AttachFormat, element.AttachSize, element.IsRequired));
                            $(columna).append(nc);
                            break;
                        case 'CDSID'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            let aID_C = Math.random().toString().substr(2, 6);
                            nc = $.parseHTML(GetCDSID(aID_C, element.Reqst_Title, element.IsRequired));
                            $(columna).append(nc);
                            cdsid.push('cdsid_' + aID_C);
                            break;
                        case 'MULTILINE'.toUpperCase():
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            let isReq = element.IsRequired || element.IsRequired == undefined ? "field-required" : "";
                            let minRows = 1;
                            let maxRows = 10;
                            let rows = (element.Order0) ? element.Order0 : minRows; // If element.Order0 is not defined, set the rows to minRows
                            rows = rows.trim(); // Remove whitespace from both sides of a string
                            rows = (isNaN(rows)) ? minRows : rows; // Validates if rows is number else assign it min Rows
                            rows = (rows < minRows) ? minRows : (rows > maxRows) ? maxRows : rows; // Validates that rows be in the range
                            nc = '<label class="font-weight-bold mr-2">' + element.Reqst_Title + '</label> <textarea style="resize: none; overflow: hidden;" class="form-control myMultiLine ' + isReq + '" rows="' + rows + '" maxRows="' + maxRows + '" onfocus="constraintMultiline(event, this)" onkeyup="constraintMultiline(event, this)"></textarea>';
                            $(columna).append(nc);
                            break;
                        case 'CUSTOM_HYPLINK':
                            columna = $.parseHTML('<div class="col-md-' + md + '"></div>');
                            nc = $.parseHTML(GetCustomHypLink(element.ID, element.Reqst_Title, element.IsRequired));
                            $(columna).append(nc);
                            break;
                        default:
                            break;
                    }
                    $(fila).append(columna);
                });
            }
            $(fila).append(columna);
            if (isAnalyst) {
                if (ctlForAnalyst) {
                    $('#ctlAnalyst').find('.card-body').append(fila);
                    $('#ctlForAnalyst').removeClass('d-none');
                } else {
                    $('#ctlRequest').find('.card-body').append(fila);
                    $('#ctlForRequestor').removeClass('d-none');
                }
                $('#ctlRequest').find('input,select').attr('disabled', 'disabled');
                $('#ctlAnalyst').find('input,select').attr('disabled', 'disabled');
                if (JSON.stringify(GetRequesters()).toUpperCase().includes(userLogin)) {
                    $('#ctlRequest').find('input,select').removeAttr('disabled');
                    $('#ctlAnalyst').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
                } else if (arrayOfAnalistas.includes(_spPageContextInfo.userLoginName.split('@').shift().toUpperCase())) {
                    $('#ctlAnalyst').find('input,select').removeAttr('disabled');
                    $('#ctlRequest').find('input[type="file"]').prev().prev().prev().prev().addClass('btn-disabled').removeClass('btn-primary');
                }
            } else {
                $(section).find('.card-body').append(fila);
            }
            isRow = false;
        });
        isCtl = true;
        if (!isAnalyst) {
            $('#dynamicForm').append(section);
        }
        $('.datepicker').datepicker({ dateFormat: 'MM dd yy', changeYear: true, changeMonth: true, yearRange: '-80:+2' });
        $('.datepicker_alt').datepicker({ dateFormat: 'yy-mm-dd', changeYear: true, changeMonth: true, yearRange: '-80:+2' });
        $('.field-required').on('blur change', function () {
            $(this).removeClass('is-valid');
            $(this).removeClass('is-invalid');
            if ($(this).val() == "" || $(this).val() == undefined) {
                $(this).addClass('is-invalid');
            } else {
                $(this).addClass('is-valid');
            }
        });
        $('.cdsidctl').css({ "text-transform": "uppercase" });
    });
}

function isREPTABLE(value) {
    return value.Columna == 'REPTABLE';
}
function isCheckBox(arr, title) {
    return arr.filter(function (el) {
        return el.Columna == 'CHBX' && el.Reqst_Title == title;
    });
}
function isRadioButton(value) {
    return value.Columna == 'RADIO';
}
function GetControls(value) {
    return value.Columna != 'REPTABLE';
}
function GetValues(arr, title) {
    return arr.filter(function (el) {
        return el.Reqst_Title == title;
    });
}

//adds new row to REPTABLE control, cloning row definition
function AddRow(r) {

    let tab = (r).closest('table');
    let arrRT = JSON.parse($(tab).attr('data-definition'));
    let td = '<tr>';
    $(tab).find('thead th').each(function (index, element) {
        if (index == $(tab).find('thead th').length - 1) {
            td += '<td><input type="button" onclick="RemoveRow(this); return false;" class="btn btn-danger btn-sm" value="REMOVE"></td>';
        } else {
            //Checks if is required, if null or undefined then is required.
            let isRequired = arrRT[index].IsRequired;
            let tipoCtl = arrRT[index].RTControlType;
            let required = isRequired || isRequired == undefined ? 'field-required' : '';
            let aID = Math.random().toString().substr(2, 6)
            switch (tipoCtl) {
                case 'CDSID':
                    let result = '';
                    result +=
                        `<input type="text" id="cdsid_${aID}" class="form-control cdsidctl text-uppercase ${required}" onblur="PeoplePicker(this.value,'${aID}')" maxlength="8" />
                                <span id="span_${aID}" class="text-info"></span>`;

                    td += `<td>${result}</td>`;
                    break;
                case 'Date':
                    td += `<td><input id="date${aID}" type="text" class="form-control ${required} mobilewauto datepicker_alt" readonly="true" /></td>`;
                    break;
                case 'Attach':
                    td += `<td>${GetAttach(aID, arrRT[index].Reqst_Title, arrRT[index].AttachFormat, arrRT[index].AttachSize, arrRT[index].IsRequired, false)}</td>`;
                    break;
                case 'DropDown':
                    td += `<td>${GetDD(aID, arrRT[index].Reqst_Title, arrRT[index].DDOptions.split(';'), null, null, arrRT[index].IsRequired, true)}</td>`;
                    break;
                default:
                    td += `<td><input type="text" class="form-control ${required} mobilewauto" maxlength="255" /></td>`;
                    break;
            }
        }
    });
    td += '</tr>';

    let newRow = td;
    $(r).closest('table').find('tbody').append(newRow);

    $('.field-required').on('blur change', function () {
        $(this).removeClass('is-valid');
        $(this).removeClass('is-invalid');
        if ($(this).val() == "" || $(this).val() == undefined) {
            $(this).addClass('is-invalid');
        } else {
            $(this).addClass('is-valid');
        }
    });

    //appends new class to added recently for datepicker functionality
    $('.datepicker_alt').datepicker({ dateFormat: 'yy-mm-dd', changeYear: true, changeMonth: true, yearRange: '-80:+2' });

    event.preventDefault();
    event.stopPropagation();

    return false;

}
//removes current row
function RemoveRow(r) {
    $(r).closest('tr').remove();
}

//gets textbox control for dynamic form
function GetTEXT(id, name, isRequired) {
    let result = '';
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    result += '<label class="font-weight-bold mr-2">' + name + '</label><input type="text" class="form-control ' + isReq + '" maxlength="255" />';
    return result;
}

function GetCustomHypLink(id, name, isRequired) {
    let result = '';
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    let placeHolderURL = '';
    let placeHolderName = '';
    let errorTxt;

    GetValueByKey('customHypeURLtxt', $('#ddlLanguage').val(), (v) => placeHolderURL = v);
    GetValueByKey('customHypeNametxt', $('#ddlLanguage').val(), (v) => placeHolderName = v);
    GetValueByKey('validURL', $('#ddlLanguage').val(), (v) => errorTxt = v);

    result += `<label class="font-weight-bold mr-2">${name}<span style="color:red" id="invalidURL_${id}" hidden> ${errorTxt}</span></label>
               <input type="text" control-type="CUSTOM_HYPLINK" class="form-control ${isReq} " maxlength="255" placeholder="${placeHolderURL}" onchange="validateCustomHP(this, ${id})">
               <input type="text" control-type="CUSTOM_HYPLINK_NAME" class="form-control ${isReq} " maxlength="255" placeholder="${placeHolderName}" onchange="validateCustomHP(this, ${id})">`;
    return result;
}

function validateCustomHP(input, id) {
    const CTRL_TYPE = $(input).attr('control-type');
    const REQUIRED = $(input).hasClass('field-required');
    const VALUE = $(input).val();
    let valid = false;
    let HPUrl = '';
    let HPName = '';

    $(input).removeClass('is-valid');
    $(input).removeClass('is-invalid');

    $('.test-btn').each(function (index, element) {
        if (parseInt($(element).attr('index')) == parseInt(id)) $(element).remove();
    });

    if (CTRL_TYPE == 'CUSTOM_HYPLINK') {

        const _name = $(input).next().val();
        HPUrl = $(input).val();
        HPName = _name;

        $(input).next().removeClass('is-valid');
        $(input).next().removeClass('is-invalid');

        if (_name !== null && _name !== '') {
            $(input).addClass('is-valid');
            $(input).next().addClass('is-valid');
            $(input).next().after(`<a class="btn btn-info btn-sm test-btn" index="${id}" onclick="testCustomHP('${HPUrl}', '${HPName}', this, ${id})" style="width:100%; color:white;">Test HyperLink <i class="fas fa-globe"></i></a>`);
            valid = true;
        }
        else if (VALUE !== '' || REQUIRED) {
            $(input).next().addClass('is-invalid');
            valid = false;
        }

        if (($(input).val() == '' && $(input).next().val() == '') && REQUIRED) {
            $(input).addClass('is-invalid');
            valid = false;
        }
        if ($(input).val() == '' && $(input).next().val() !== '') {
            $(input).addClass('is-invalid');
            valid = false;
        }
        if (!validURL($(input).val()) && $(input).val() !== '') {
            $(input).addClass('is-invalid');
            $(`#invalidURL_${id}`).attr('hidden', false);
            valid = false;
        } else {
            $(input).addClass('is-valid');
            $(`#invalidURL_${id}`).attr('hidden', true);
        }
    }
    else if (CTRL_TYPE == 'CUSTOM_HYPLINK_NAME') {

        const _name = $(input).prev().val();
        HPUrl = $(input).val();
        HPName = _name;

        $(input).prev().removeClass('is-valid');
        $(input).prev().removeClass('is-invalid');

        if (_name !== null && _name !== '') {
            $(input).prev().addClass('is-valid');
            $(input).addClass('is-valid');
            $(input).after(`<a class="btn btn-info btn-sm test-btn" index="${id}" onclick="testCustomHP('${HPName}', '${HPUrl}', this, ${id})" style="width:100%; color:white;">Test HyperLink <i class="fas fa-globe"></i></a>`);
            valid = true;
        }
        else if (VALUE !== '' || REQUIRED) {
            $(input).prev().addClass('is-invalid');
            valid = false;
        }

        if (($(input).val() == '' && $(input).prev().val() == '') && REQUIRED) {
            $(input).addClass('is-invalid');
            valid = false;
        }
        if ($(input).val() == '' && $(input).prev().val() !== '') {
            $(input).addClass('is-invalid');
            valid = false;
        }
        if (!validURL($(input).prev().val()) && $(input).val() !== '') {
            $(input).prev().addClass('is-invalid');
            $(`#invalidURL_${id}`).attr('hidden', false);
            valid = false;
        } else {
            $(input).prev().addClass('is-valid');
            $(`#invalidURL_${id}`).attr('hidden', true);
        }

    }
    if (!valid) {
        $('.test-btn').each(function (index, element) {
            if (parseInt($(element).attr('index')) == parseInt(id)) $(element).remove();
        });
    }
}

function testCustomHP(url, name, input, id, type = 1) {

    let placeHolderURL;
    let placeHolderName;

    GetValueByKey('customHypeURLtxt', $('#ddlLanguage').val(), (v) => placeHolderURL = v);
    GetValueByKey('customHypeNametxt', $('#ddlLanguage').val(), (v) => placeHolderName = v);

    if (type == 1) {
        $(input).prev().remove();
        $(input).prev().remove();

        let btnPreview = `<a href="${url}" class="btn btn-info btn-block mb-2" style="color:#fff" target="_blank">${name} <i class="fas fa-link"></i></a>
                        <a class="btn btn-danger btn-sm test-btn" onclick="testCustomHP('${url}', '${name}', this, ${id}, 2)" style="color:#fff; width:100%;" onclick="">Undo <i class="fas fa-undo-alt"></i></a>`;
        $(input).after(btnPreview);
        $(input).remove();
    } else {
        let inputsUndo = `
        <input type="text" control-type="CUSTOM_HYPLINK" value="${url}" class="form-control" placeholder="${placeHolderURL}" maxlength="255" placeholder="" onchange="validateCustomHP(this, ${id})">
        <input type="text" control-type="CUSTOM_HYPLINK_NAME" value="${name}" class="form-control" placeholder="${placeHolderName}" maxlength="255" placeholder="" onchange="validateCustomHP(this, ${id})">
        <a class="btn btn-info btn-sm test-btn" index="${id}" onclick="testCustomHP('${url}', '${name}', this, ${id})" style="width:100%; color:white;">Test HyperLink <i class="fas fa-globe"></i></a>`;

        $(input).after(inputsUndo);
        $(input).prev().remove();
        $(input).remove();

    }
}

function validURL(str) {
    let pattern = new RegExp(/(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/gi); // fragment locator

    return pattern.test(str);
}

//gets hyper links controls for dynamic form
function GetHypLink(funcion, title) {
    let result = '';
    Encoder.EncodeType = 'entity';
    funcion = funcion.toString().replace('<br/>', '').replace('<br>', '');
    if (funcion.toString().indexOf('<div') > -1) {
        funcion = Encoder.htmlDecode($(funcion).text());
    } else {
        funcion = Encoder.htmlDecode(funcion);
    }

    funcion = funcion.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '')
    result += '<a class="btn btn-primary btn-block" style="color:white" href="' + funcion + '" target="_blank"><i class="fa fa-link" aria-hidden="true"></i> ' + title + '</a>';
    return result;
}

//gets LIST control for dynamic form
function GetLIST(lista) {
    let result = '<p>';
    result += lista;
    result += '</p>';
    return result;
}

//Gets DATE control for dynamic form 
function GetDate(id, funcion, isRequired) {
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    let result = '<label class="font-weight-bold mr-2">' + funcion + '</label><input id="' + id + '" type="text" class="form-control datepicker ' + isReq + '" readonly="true" /> ';
    return result;
}

//Sets max date allowed for datepicker controls
function SetMaxDate(idc, ctl) {
    let fecha = $('#' + idc).val().split(' ');
    var max = new Date(fecha[2], MONTHS.indexOf(fecha[0]), fecha[1]);
    var newMax = new Date(fecha[2], MONTHS.indexOf(fecha[0]), fecha[1]);
    let id = $("input[id^='" + ctl + "']").attr('id');
    let startDays = $('#' + id).attr('data-days-min');
    startDays = (startDays !== undefined) ? startDays : 0;
    var max = new Date(fecha[2], MONTHS.indexOf(fecha[0]), parseInt(fecha[1]) + parseInt(startDays));
    var newMax = new Date(fecha[2], MONTHS.indexOf(fecha[0]), parseInt(fecha[1]) + parseInt(startDays));

    newMax.setDate(newMax.getDate() + parseInt($('#' + id).attr('data-days')));
    $('#' + id).datepicker("option", { minDate: max, maxDate: newMax, changeYear: true, changeMonth: true });
}

//Gets RADIO control for dynamic form
function GetRadioButton(values) {
    Encoder.EncodeType = 'entity';

    let result = '';
    let groups = GetUniquesValues(values, "Reqst_Title");
    $(groups).each(function (index, element) {
        let newGroup = values.filter(function (value) {
            return value.Reqst_Title == element;
        });
        result += '<div class="btn-group-horizontal w-100"><span class="font-weight-bold">' + element.toUpperCase() + '</span><br>';
        $(newGroup).each(function (index, element) {
            let opcion = element.Funcion;
            if (element.Funcion.toString().indexOf('<div') > -1) {
                opcion = Encoder.htmlDecode($(element.Funcion).text());
            }
            if (index == 0) {
                result += '<label class="mb-0 mr-4 text-left"> <input type="radio" name="' + element.Reqst_Title + '" checked > ' + opcion + '</label>';
            } else {
                result += '<label class="mb-0 mr-4 text-left"> <input type="radio" name="' + element.Reqst_Title + '" > ' + opcion + '</label>';
            }
        });
        result += '</div>';
    });
    return result;
}

//Gets DropDown control for dynamic form
function GetDD(id, name, data, dependsOn, fillTo, isRequired, forRT) {
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    if (isNullOrWhitespace(forRT) || !forRT) {

        Encoder.EncodeType = "entity";
        let titulo = name;

        name = name.toString().replace(/:/g, '');
        name = name.toString().replace(/ /g, '');
        let result = $.parseHTML('<div></div>');
        let select = $.parseHTML('<select id="DDL_' + name + '" class="form-control w-100 ' + isReq + '"></select>');
        let label = $.parseHTML('<label class="font-weight-bold mr-1">' + titulo + '</label>');

        if (isNullOrWhitespace(dependsOn)) {
            $(select).append($('<option data-lang="optSelectText">').val("").text("Select"));
            $(data).each(function (index, element) {
                let texto = Encoder.htmlDecode($(element.Funcion).text());
                let valor = element.Order0;
                $(select).append(new Option(texto, valor));
            });
        } else {
            let newData = [];
            $(data).each(function (index, element) {
                let texto = Encoder.htmlEncode($(element.Funcion).text());
                let valor = element.Order0;
                let opt = texto + ";" + valor;
                newData.push(opt);
            });
            let hf = $.parseHTML('<input type="hidden" id="hf_' + name + '" value=\'' + JSON.stringify(newData) + '\' >');

            $('#dynamicForm').append(hf);
        }

        if (!isNullOrWhitespace(fillTo)) {
            fillTo = fillTo.toString().replace(/:/g, '');
            $(select).attr('onchange', "FillTo(this, '" + fillTo + "')");
        }

        $(result).append(label);
        $(result).append(select);

    } else {
        let newData = [];
        let select = $.parseHTML('<select id="DDL_' + name + '" class="form-control w-100 ' + isReq + '"></select>');
        $(select).append($('<option data-lang="optSelectText">').val("").text("Select"));
        $(data).each(function (index, element) {
            let texto = Encoder.htmlDecode(element);
            $(select).append(new Option(texto, texto));
        });
        result = select[0].outerHTML;
        return result;
    }
}

//Fuction to fill options to the corresponding dropdown control
function FillTo(ddl, ctlID) {

    let selected = $(ddl).find('option:selected').val();
    $('#DDL_' + ctlID).find('option').remove();
    if (isNullOrWhitespace(selected)) {
        return;
    }

    let data = JSON.parse($('#hf_' + ctlID).val());
    let newData = data.filter(function (value) {
        return value.endsWith(selected.substr(selected.toString().lastIndexOf('.')));
    });

    $('#DDL_' + ctlID).append(new Option('Select', ''));
    $(newData).each(function (index, element) {
        texto = element.substr(0, element.lastIndexOf(';'));
        valor = element.substr(element.lastIndexOf('.'), element.length);
        $('#DDL_' + ctlID).append(new Option(texto, valor));
    });

}

//Gets CHBX controls for dynamic form
function GetCheckBOX(values) {
    Encoder.EncodeType = 'entity';
    let result = '';
    let groups = GetUniquesValues(values, "Reqst_Title");
    $(groups).each(function (index, element) {
        let newGroup = values.filter(function (value) {
            return value.Reqst_Title == element;
        });
        let id = Math.random().toString().substring(2, 6);
        let idcbl = 'cbl_' + id;
        result += '<div id="' + idcbl + '" class="btn-group-vertical w-100"><span class="font-weight-bold">' + element.toUpperCase() + '</span>';
        $(newGroup).each(function (index, element) {
            let opcion = element.Funcion;
            if (element.Funcion.toString().indexOf('<div') > -1) {
                opcion = Encoder.htmlDecode($(element.Funcion).text());
            }
            result += '<label class="btn btn-block mb-0 text-left"> <input type="checkbox" autocomplete="off"> ' + opcion + '</label>';
        });
        //validate if is neccesary at least one option selected
        let req = $(newGroup).filter((i, v) => v.IsRequired == true).length > 0;
        result += `<input type="hidden" id="hf_${id}" value="${req}" >`;
        result += '</div>';
    });
    return result;
}

//Gets CDSID control for dynamic form
function GetCDSID(id, title, isRequired) {
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    let result = '';
    result += '<label class="font-weight-bold mr-2 w-100">' + title + '</label><input type="text" id="cdsid_' + id + '" class="form-control cdsidctl ' + isReq + '" onblur="PeoplePicker(this.value,' + id.toString() + ')" />';
    result += '<br><span id="span_' + id + '" class="text-info"></span>';
    return result;
}

/**
 * Function to get an html input control in a dynamic form
 */
function GetAttach(id, title, ext, size, isRequired, clickTo) {
    clickTo = isNullOrWhitespace(clickTo) ? true : clickTo;
    let isReq = isRequired || isRequired == undefined ? "field-required" : "";
    let result = '';

    let help = '';
    let extensiones = '';
    let tamanio = '';

    let lblExt = '', lblMaxSize = '';
    GetValueByKey('lblExt', Language, (v) => lblExt = v);
    GetValueByKey('lblMaxSize', Language, (v) => lblMaxSize = v);

    lblExt = `<span data-lang="lblExt">${lblExt}</span>`;
    lblMaxSize = `<span data-lang="lblMaxSize">${lblMaxSize}</span>`;

    if (ext != '' && ext != undefined)
        extensiones = `${lblExt} ${ext}`;
    if (size != '' && size != undefined)
        tamanio = ` ${lblMaxSize} ${size} kb.`;

    if (extensiones != '' || tamanio != '') {
        help = '<span class="text-muted">' + extensiones + tamanio + '</span><br>';
    } else {
        help = '<span></span><span></span>';
    }

    if (!clickTo) {
        let lang = $('#ddlLanguage').val();
        GetValueByKey('lblAttach', lang, function (data) { title = `<span data-lang="lblAttach">${data}</span>` });
    }

    result += '<label for="Attach_' + id + '"" class="btn btn-primary btn-block">';
    result += '<i class="fa fa-upload" aria-hidden="true"></i> ' + title;
    result += clickTo ? ' (Click to upload)</label>' : '</label>';
    result += help;
    result += '<span class="file-selected text-muted font-weight-bold"></span>';
    result += '<input id="Attach_' + id + '" type="file" onchange="fileEvents(this)" class="' + isReq + '" />';
    result += '<input type="hidden" id="hdfAttach_' + id + '" value="' + (ext == null ? '' : ext) + '|' + (size == null ? '' : size) + '"></input>';

    return result;
}

//Event for file upload controls
function fileEvents(t) {

    let real;
    let fileName = '';
    fileName = $(t).val();
    let sizeFormat = $(t).next('input:hidden').val();
    real = fileName.split('\\');
    if (real.length > 0) {
        fileName = real[real.length - 1];
    }

    let arraySizeFormat = sizeFormat.split('|');
    let format = arraySizeFormat[0].toLowerCase();
    let size = arraySizeFormat[1];
    let sizeFile = (t.files[0].size / 1024);
    let formatFile = t.files[0].name.split('.').pop().toLowerCase();
    let existError = false;

    // Evaluate if it is a valid format according to the configuration
    if (format != '' && size != '') {
        if (format.indexOf(formatFile) == -1 || sizeFile > size) {
            existError = true;
        }
    }

    //Evaluate if the format or size is configured
    else if (format != '' || size != '') {
        if (format != '' && format.indexOf(formatFile) == -1) {
            existError = true;
        }
        else if (size != '' && sizeFile > size) {
            existError = true;
        }

    }

    //If there is no configuration, can upload any file and any format
    else if (format == '' && size == '') {
        existError = false;
    }

    if (existError) {
        $(t).val('');
        t.files[0] = '';
        $(t).prev('span.file-selected').html("El formato o tamaño del archivo no es válido");
        $(t).prev('span.file-selected').addClass('text-danger').removeClass('text-muted');
    }
    else {
        $(t).prev('span.file-selected').html(fileName);
        $(t).prev('span.file-selected').addClass('text-muted').removeClass('text-danger');
        $(t).prev().prev().prev().prev().removeClass('btn-danger');
        $(t).prev().prev().prev().prev().addClass('btn-primary');
    }
}

//Gets REPTABLE control for dynaic form
function GetREPTABLE(newArray) {
    let fech = new Date();
    let gid = fech.getSeconds() + fech.getMilliseconds();
    let idc = `tbl_${gid}`;
    newArray = newArray.sort(compareValues('Order0'));
    let tab = $('<table id="' + idc + '" class="table table-condensed table-bordered"><thead class="text-nowrap"></thead><tbody></tbody><tfoot></tfoot></table>');
    if (newArray.length > 0) {
        let th = '<tr>';
        $(newArray).each(function (index, element) {
            th += '<th scope="col">' + element.Reqst_Title + '</th>';
        });
        th += '<th scope="col"></th>';
        th += '</tr>';
        $(tab).find('thead').append(th);

        td = '<tr>';
        $(tab).attr('data-definition', JSON.stringify(newArray));

        for (let j = 0; j < $(tab).find('thead th').length; j++) {
            if (j == $(tab).find('thead th').length - 1) {
                td += '<td></td>';
            } else {
                let isRequired = newArray[j].IsRequired;
                let tipoCtl = newArray[j].RTControlType;
                let required = isRequired || isRequired == undefined ? 'field-required' : '';

                let aID = Math.random().toString().substr(2, 6)
                switch (tipoCtl) {
                    case 'CDSID':
                        let result = '';
                        result +=
                            `<input type="text" id="cdsid_${aID}" class="form-control cdsidctl mobilewauto text-uppercase ${required}" onblur="PeoplePicker(this.value,'${aID}')" maxlength="8" />
                                <span id="span_${aID}" class="text-info"></span>`;

                        td += `<td>${result}</td>`;
                        break;
                    case 'Date':
                        td += `<td><input id="date${aID}" type="text" class="form-control ${required} mobilewauto datepicker_alt" readonly="true" /></td>`;
                        break;
                    case 'Attach':
                        td += `<td>${GetAttach(aID, newArray[j].Reqst_Title, newArray[j].AttachFormat, newArray[j].AttachSize, newArray[j].IsRequired, false)}</td>`;
                        break;
                    case 'DropDown':
                        td += `<td>${GetDD(aID, newArray[j].Reqst_Title, newArray[j].DDOptions.split(';'), null, null, newArray[j].IsRequired, true)}</td>`;
                        break;
                    default:
                        td += `<td><input type="text" class="form-control ${required} mobilewauto" maxlength="255" /></td>`;
                        break;
                }
            }
        }

        td += '</tr>';
        let tfoot = '<tr><td colspan="' + newArray.length + 1 + '" ><input type="button" onclick="AddRow(this); return false;" class="btn btn-primary btn-sm" value="ADD NEW"></td></tr>';
        $(tab).find('tbody').append(td);
        $(tab).find('tfoot').append(tfoot);
    }

    return tab;
}

//Gets new section for dynamic form
function GetNewSection(name) {
    let result = '';
    let reqfor = '';
    GetValueByKey('RequestFor', $('#ddlLanguage').val(), function (d) { reqfor = d; })

    let defaultTitle = '<span data-lang="RequestFor">' + reqfor + '</span>&nbsp;' + $('#ddRequestType').val();
    let title = isNullOrWhitespace(name) ? defaultTitle : name;

    result += '<div class="card mb-2 w-100">';
    result += '<div class="card-header"><h2>' + title + '</h2></div>';
    result += '<div class="card-body">';
    result += '</div></div>';

    return result;
}

// function for dynamic sorting
function compareValues(key, order) {

    order == undefined ? order = 'asc' : order = order;
    return function (a, b) {
        if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
            return 0;
        }

        const varA = (typeof a[key] === 'string') ?
            a[key].toUpperCase() : a[key];
        const varB = (typeof b[key] === 'string') ?
            b[key].toUpperCase() : b[key];

        let comparison = 0;
        if (varA > varB) {
            comparison = 1;
        } else if (varA < varB) {
            comparison = -1;
        }
        return (
            (order == 'desc') ? (comparison * -1) : comparison
        );
    };
}

function isNullOrWhitespace(input) {

    if (typeof input === 'undefined' || input == null) return true;

    return input.toString().replace(/\s/g, '').length < 1;
}

//#endregion

//#region Survey

function ShowPorque(t) {
    $('#hfSINO').val("NO");
    $(t).parent().parent().next('div').show();
    $(t).parent().parent().next('div').next('div').show();
    $(t).parent().parent().find('button').attr('disabled', 'disabled');
}

function ShowLevels(t) {
    $('#hfSINO').val("SI");
    $(t).parent().parent().next('div').next('div').show();
    $(t).parent().parent().find('button').attr('disabled', 'disabled');
}

//Function to save survey answer
async function SaveSurvey() {

    let survey = {}
    let createdBy = userLogin;
    let reqID = $('#currentRequestId').val();
    let nivel = $('#dvEncuesta input[type="radio"]:checked').closest('label').text().trim();
    let lang = $('#ddlLanguage option:selected').val().trim();

    nivel = nivel.replace(/\n/g, '');

    survey['SeAtendio'] = $('#hfSINO').val();
    survey['NivelSatisfaccion'] = nivel;
    survey['Comentarios'] = $('#txtPorque').val();

    let obj = {
        "__metadata": {
            "type": "SP.Data.UniversalRequestListItem"
        },
        "Status": COMPLETED,
        "Survey": JSON.stringify(survey)
    };

    try {

        let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${reqID})`;
        try {
            const response = await fetch(path, {
                method: 'POST',
                contentType: 'application/json;odata=verbose',
                data: JSON.stringify(obj),
                headers: MERGE
            });
            const data = await response.json();

            CreateLOG(reqID, createdBy, PHASE.SURVEY, null);

            $('#atendio').text(survey.SeAtendio);
            let clase = survey.SeAtendio == "SI" ? "text-success" : "text-danger";
            $('#atendio').addClass(clase);
            $('#nivel').text(survey.NivelSatisfaccion);
            $('#surveyComments').text(survey.Comentarios);
            $('#dvRespEncuesta').show();

            $('#dvEncuesta').modal("hide");

            return data;
        } catch (e) {
            console.log(e);
            return e;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

function RestartSurvey() {
    $('#hfSINO').val("");
    $('#txtPorque').val("")
    $('#dvEncuesta input[type="radio"]').prop('checked', false);
    $('#dvEncuesta input[type="radio"]').closest('div.w-100').parent().hide();
    $('#txtPorque').closest('div.w-100').parent().hide();


    $('.modal-footer').find('button').removeAttr('disabled');
    $('#btnSubmitSurvey').hide();
    $('#btnRestablecer').hide();

    return false;
}

//#endregion


//#region  Approvals
async function ChangeCDSIDApproval(control) {
    let CDSID = $(control).val();
    let username = DOMAIN365.replace(/#/g, '%23') + CDSID + FORD;
    let label = $(control).next('span');

    if (CDSID != "" && CDSID != undefined) {
        try {
            const response = await GetPropertiesFor(username);
            if (response.d.UserProfileProperties == undefined) {
                $(label).empty().text('CDSID doesn\'t exist');
                $(label).addClass('text-danger').removeClass('text-info');
                $('#btnSubmit').attr('disabled', 'disabled');
            } else {
                newUser = response.d;
                $(label).text(newUser.DisplayName);
                $(label).addClass('text-info').removeClass('text-danger');
                $('#btnSubmit').removeAttr('disabled');
                IsReqEqApp();
                isLL6();
            }
        } catch (e) {
            console.log(e);
            return e;
        }
    } else {
        ClearReqData();
        $(label).empty();
    }
    IsReqEqApp();
}

async function GetCDSIDApproval(control, valueCDSID) {
    let CDSID = valueCDSID;
    $('#' + control).val(CDSID);
    let label = $('#' + control).next('span');
    if (CDSID != "" && CDSID != undefined) {
        GetPeopleName(CDSID, label, true);
        try {
            const response = await GetPropertiesFor(domain + CDSID + FORD);
            newUser = response.d;
            FillNewGetCDSIDApproval(control);
        } catch (e) {
            console.log(e);
            return e;
        }
    } else {
        ClearReqData();
        $(label).empty();
    }
}

async function FillNewCDSIDApproval(control) {
    arrayApprovalsLL6 = [];

    let fila = $(control).closest('div').parent();
    let noIsLL6OrMore = false;
    let CDSIDApproval = $(control).val();

    let username = domain + CDSIDApproval + FORD;
    try {
        const response = await GetPropertiesFor(username);
        let mr = GetByProp(response.d.UserProfileProperties.results, "ManagerRole");
        noIsLL6OrMore = mr == "N" || isNullOrWhitespace(mr);
        if (newUser == undefined) {
            ClearReqDataApproval(control);
            $(control).next('span').empty().text('CDSID Doesn\'t exist');
            $('#btnSubmit').attr('disabled', 'disabled');
            $('#btnSaveAdmin').attr('disabled', 'disabled');
            return;
        }
        else {
            let CDSID = newUser.Email.split('@')[0].toUpperCase();
            let name = GetByProp(newUser.UserProfileProperties.results, "FirstName");
            let lastName = GetByProp(newUser.UserProfileProperties.results, "LastName");

            $(fila).find('div:eq(1) span').addClass('text-info').removeClass('text-danger');
            $(fila).find('div:eq(2) span').text(CDSID);
            $(fila).find('div:eq(3) span').text(name + ' ' + lastName);

            $('#btnSubmit').removeAttr('disabled');
            $('#btnSaveAdmin').removeAttr('disabled');
        }
    } catch (e) {
        console.log(e);
        return e;
    }
}

function FillNewGetCDSIDApproval(control) {
    let fila = $('#' + control).closest('div').parent();
    if (newUser == undefined) {
        ClearReqDataApproval();
        $(control).next('span').empty().text('CDSID Doesn\'t exist');
        return;
    } else {
        let CDSID = newUser.Email.split('@')[0].toUpperCase();
        let name = GetByProp(newUser.UserProfileProperties.results, "FirstName");
        let lastName = GetByProp(newUser.UserProfileProperties.results, "LastName");

        $(fila).find('div:eq(1) span').addClass('text-info').removeClass('text-danger');

        $(fila).find('div:eq(2) span').text(CDSID);
        $(fila).find('div:eq(3) span').text(name + ' ' + lastName);
    }

}

function ClearReqDataApproval(fila) {
    let row = $(fila).closest('div').parent();
    $(row).find('div:eq(2) span').text('');
    $(row).find('div:eq(3) span').text('');
}

async function GetFillReqDataApproval(control, userApproval) {

    let fila = $('#' + control).closest('div').parent();
    let objGetApproval;

    if (!isNullOrWhitespace(userApproval)) {
        userApproval = userApproval.indexOf('\\') > -1 ? userApproval.split('\\')[1] : userApproval;
        userApproval = DOMAIN365.replace(/#/g, '%23') + userApproval + FORD;

        try {
            const response = await GetPropertiesFor(userApproval);
            if (response.d.DisplayName != "" && response.d.DisplayName != undefined) {
                objGetApproval = response.d;
                let arr = objGetApproval.UserProfileProperties.results;

                let preferredName = objGetApproval.DisplayName;
                let CDSID = objGetApproval.Email.split('@')[0].toUpperCase();
                let user = GetByProp(arr, "AccountName");
                let name = GetByProp(arr, "FirstName");
                let lastName = GetByProp(arr, "LastName");

                let label = $('#' + control).next('span');
                $(label).removeClass('text-danger');
                $('#' + control).next('span').empty().text(preferredName);
                $('#' + control).addClass('is-valid').removeClass('is-invalid');
                $(fila).find('div:eq(1) input:hidden').val(CDSID);
                $('#btnSubmit').removeAttr('disabled');

            }
        } catch (e) {
            console.log(e);
            return e;
        }
    }
}

function FillApprovalsDone(arr, arrOrd, isJson, isRandom) {
    let i = 0;
    let j = 0;
    let req = GetRequesters();


    if (isRandom) {

        if (isJson) {

            arrOrd.forEach((value) => {
                j++;


                if (value.Approval !== null) {
                    let approvalsarr = cleanCDSIDDomain(value.Approval.toString()).trim();
                } else {
                    let approvalsarr = null;
                }

                let appCDSID = "";

                if (approvalsarr != "" && approvalsarr != undefined) {
                    approvalsarr = approvalsarr.replace(/,/g, ";");
                    appCDSID = approvalsarr.split(';')[0];
                }

                let label = $('#txtApproval' + j).next('span');

                $('#txtApproval' + j).val(appCDSID);
                $('#txtApproval' + j).data('config', JSON.stringify(value));
                $('#txtApproval' + j).data('name', arr[i].d.DisplayName);
                $('#txtApproval' + j).attr('disabled', !isNullOrWhitespace(value.Date));

                if (!isNullOrWhitespace(value.Date)) {
                    $('#txtApproval' + j).closest('tr').find('td:eq(2)').append('&nbsp;<span class="text-success"><i class="fa fa-check-circle" aria-hidden="true"></i></span>');
                    $('#txtApproval' + j).closest('tr').find('td:eq(1)').append(`<br><span>${value.Comments}</span>`);
                }

                if (req.indexOf(!isNullOrWhitespace(value.Approval) ? value.Approval.toUpperCase() : value.Approval) > -1) {
                    let msj = '';
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger');
                } else {
                    $(label).html(arr[i].d.DisplayName);
                    $(label).addClass('text-info').removeClass('text-danger');
                    $('#txtApproval' + j).addClass('is-valid').removeClass('is-invalid');
                }
                i++;
            })
        } else {
            let approvalsarr;
            arrOrd.forEach((value) => {
                if (value.ApprovalCDSID !== null) {
                    approvalsarr = cleanCDSIDDomain(value.ApprovalCDSID).trim();
                } else {
                    approvalsarr = null;
                }
                let appCDSID = "";

                if (approvalsarr != "" && approvalsarr != undefined) {
                    approvalsarr = approvalsarr.replace(/,/g, ";");
                    appCDSID = approvalsarr.split(';')[0];
                }

                j++;
                let label = $('#txtApproval' + j).next('span');

                $('#txtApproval' + j).val(appCDSID);
                if (isNullOrWhitespace(appCDSID) && value.MustBeLL6) {
                    SetLL6(userName, $('#txtApproval' + j));
                }

                $('#txtApproval' + j).data('config', JSON.stringify(value));
                $('#txtApproval' + j).data('name', arr[i].d.DisplayName);
                if (req.indexOf(!isNullOrWhitespace(appCDSID) ? appCDSID.toUpperCase() : appCDSID) > -1) {
                    let msj = '';
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger');
                } else {
                    $(label).html(arr[i].d.DisplayName);
                    $(label).addClass('text-info').removeClass('text-danger');
                    $('#txtApproval' + j).addClass('is-valid').removeClass('is-invalid');
                }
                i++;
            })
        }

    } else {
        if (isJson) {
            let j = 0;
            arrOrd.forEach((value) => {
                if (value.Approval !== null) {
                    let approvalsarr = cleanCDSIDDomain(value.Approval.toString()).trim();
                } else {
                    let approvalsarr = null;
                }

                let appCDSID = "";

                if (approvalsarr != "" && approvalsarr != undefined) {
                    approvalsarr = approvalsarr.replace(/,/g, ";");
                    appCDSID = approvalsarr.split(';')[0];
                }

                j++;
                let label = $('#txtApproval' + j).next('span');

                $('#txtApproval' + j).val(appCDSID);
                $('#txtApproval' + j).data('config', JSON.stringify(value));
                $('#txtApproval' + j).data('name', arr[i].d.DisplayName);
                $('#txtApproval' + j).attr('disabled', !isNullOrWhitespace(value.Date));

                if (!isNullOrWhitespace(value.Date)) {
                    $('#txtApproval' + j).closest('tr').find('td:eq(2)').append('&nbsp;<span class="text-success"><i class="fa fa-check-circle" aria-hidden="true"></i></span>');
                    $('#txtApproval' + j).closest('tr').find('td:eq(1)').append(`<br><span>${value.Comments}</span>`);
                }

                if (req.indexOf(!isNullOrWhitespace(appCDSID) ? appCDSID.toUpperCase() : appCDSID) > -1) {
                    let msj = '';
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger');
                } else {
                    $(label).html(arr[i].d.DisplayName);
                    $(label).addClass('text-info').removeClass('text-danger');
                    $('#txtApproval' + j).addClass('is-valid').removeClass('is-invalid');
                }
                i++;
            })
        } else {

            let cont = 1;

            arrOrd.forEach((value) => {

                let approvalsarr;
                if (value.ApprovalCDSID !== null) {
                    approvalsarr = cleanCDSIDDomain(value.ApprovalCDSID.toString()).trim();
                } else {
                    approvalsarr = null;
                }

                let appCDSID = "";

                if (approvalsarr != "" && approvalsarr != undefined) {
                    approvalsarr = approvalsarr.replace(/,/g, ";");
                    appCDSID = approvalsarr.split(';')[0];
                }

                let label = $('#txtApproval' + cont).next('span');
                $('#txtApproval' + cont).val(appCDSID);

                //if value.ApprovalCDSID is null or empty and MustBeLL6 is true get manager CDSID
                if (isNullOrWhitespace(appCDSID) && value.MustBeLL6) {
                    SetLL6(userName, $('#txtApproval' + value.ApprovalOrder));
                }

                $('#txtApproval' + cont).data('config', JSON.stringify(value));
                $('#txtApproval' + cont).data('name', arr[i].d.DisplayName);
                if (req.indexOf(!isNullOrWhitespace(appCDSID) ? appCDSID.toUpperCase() : appCDSID) > -1) {
                    let msj = '';
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger');
                } else {
                    $(label).html(arr[i].d.DisplayName);
                    $(label).addClass('text-info').removeClass('text-danger');
                    $('#txtApproval' + cont).addClass('is-valid').removeClass('is-invalid');
                }
                i++;
                cont++;
            })
        }
    }

    $('#approvalsSection').show();

}

function OnChangeApproval(control) {

    try {

        let msj = '';
        let label = $(control).next('span');
        let req = GetRequesters();
        let conf = JSON.parse($(control).data('config'));

        GetPropertiesFor(DOMAIN365.replace(/#/g, '%23') + $(control).val() + FORD).then(function (data) {
            if (data.d.UserProfileProperties != null) {
                if (req.indexOf(data.d.Email.split('@')[0].toUpperCase()) > -1) {
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger');
                    $(control).addClass('is-invalid').removeClass('is-valid');
                } else {
                    if (isNullOrWhitespace(conf.ApprovalCDSID)) {
                        if (conf.MustBeLL6 && GetByProp(data.d.UserProfileProperties.results, "ManagerRole") == "N") {
                            let msj = '';
                            GetValueByKey('msjApproverLL6', $('#ddlLanguage option:selected').val(), function (v) { msj = v; });
                            $(label).html(msj);
                            $(label).addClass('text-danger');
                            $(control).addClass('is-invalid').removeClass('is-valid');
                        } else {
                            $(label).html(data.d.DisplayName);
                            $(label).removeClass('text-danger');
                            $(control).addClass('is-valid').removeClass('is-invalid');
                        }
                    }
                    else {
                        if (conf.ApprovalCDSID.toUpperCase().indexOf($(control).val().toUpperCase()) < 0 && conf.MustBeLL6 && GetByProp(data.d.UserProfileProperties.results, "ManagerRole") == "N") {
                            let msj = '';
                            GetValueByKey('msjApproverLL6', $('#ddlLanguage option:selected').val(), function (v) { msj = v; });
                            $(label).html(msj);
                            $(label).addClass('text-danger');
                            $(control).addClass('is-invalid').removeClass('is-valid');
                        } else {
                            $(label).html(data.d.DisplayName);
                            $(label).removeClass('text-danger');
                            $(label).addClass('text-info');
                            $(control).addClass('is-valid').removeClass('is-invalid');
                        }
                    }
                }
            } else {

                GetValueByKey('lblCDSIDde', $('#ddlLanguage option:selected').val(), function (v) { msj = v });

                $(label).html(msj);
                $(label).addClass('text-danger');
                $(control).addClass('is-invalid').removeClass('is-valid');
            }

        });

    } catch (error) {
        console.log(JSON.stringify(error));
    }
}

function Approve(control) {

    try {

        $(control).attr('disabled', 'disabled');
        let index = 0;
        if (globalIsSec) {
            let level = JSON.parse($('#hfDataApp').val());

            for (let i = 0; i < level.length; i++) {
                const element = level[i];
                if (element.Date == null) {
                    break;
                }
                index++;
            }

            let appAll = level[index].Approval;
            let appId = appAll.split(";")[0];
            if (!isNullOrWhitespace(appAll)) { appAll = appAll.replace(/,/g, ";"); appAll = appAll.toUpperCase().replace(userLogin, ''); }
            if (appAll.split(";").length > 1) { appAll = userLogin + ";" + appAll; } else { appAll = userLogin; }
            appAll = appAll.replace(/;;/g, ";")

            //ACTUALIZA JSON CON EL ID QUE ENTRO A APROBAR
            if (level[index].Approval.toUpperCase().indexOf(userLogin.toUpperCase()) > 0 && userLogin.toUpperCase() != appId.toUpperCase()) {
                level[index].Approval = appAll;
                level[index].Name = displayName;
            }

            level[index].Date = formatDate(new Date());
            level[index].Comments = $('#txtAppComments').val();

            Approver(index + 1, level.length, JSON.stringify(level));
        } else {
            //aleatorio
            let level = JSON.parse($('#hfDataApp').val());
            let objApp = {};
            for (let i = 0; i < level.length; i++) {
                const element = level[i];

                let appAll = element.Approval;
                if (!isNullOrWhitespace(appAll)) { appAll = appAll.replace(/,/g, ";"); appAll = appAll.toUpperCase().replace(userLogin, ''); }
                if (appAll.split(";").length > 1) { appAll = userLogin + ";" + appAll; } else { appAll = userLogin; }
                appAll = appAll.replace(/;;/g, ";")

                if (appAll.split(";")[0].toUpperCase() == (userLogin).toUpperCase() && element.Date == null) {
                    objApp["Approval"] = appAll;
                    objApp["Date"] = formatDate(new Date());
                    objApp["Comments"] = $('#txtAppComments').val();
                    break;
                }
            }
            ApproverRandom(objApp);
        }
    } catch (error) {
        console.log(error);
    }
}

function Reject(control) {

    try {

        if (isNullOrWhitespace($('#txtAppComments').val())) {
            $('#txtAppComments').next('div').show();
            $('#alertErrorApp').show();//bloques
            return;
        } else
            $('#txtAppComments').next('div').hide();
        $('#alertErrorApp').hide();//bloques
        $('#txtAppComments').addClass('is-valid');
        $('#txtAppComments').removeClass('is-invalid');

        let level = JSON.parse($('#hfDataApp').val());
        for (let i = 0; i < level.length; i++) {
            const element = level[i];
            element.Date = null;
            element.Comments = null;
        }

        Rejection(JSON.stringify(level));


    } catch (error) {
        alert(JSON.stringify(error));
    }

}

function formatDate(date) {
    let d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

function GetRequesters() {
    let result = [];
    let arr = $('#tblRequester').find('tbody tr');
    for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        result.push($(e).find('td:eq(0) input').val().toUpperCase());
    }
    return result;
}

let arrayApprovals = [];
let arrayAppCheck = [];
async function FillApprovals(response, isJson) {
    arrayApprovals = [];
    arrayAppCheck = [];
    let arrOrd;

    if (isJson) {
        arrOrd = JSON.parse(response);
        let tabla = $('#approvalsSection').find('table');
        $(tabla).find('tbody tr').remove();
        let i = 0;
        arrOrd.forEach((value) => {
            let approvalsarr = "";
            if (!isNullOrWhitespace(value.Approval)) {
                approvalsarr = value.Approval.toUpperCase();
            }

            let appCDSID = "";
            let applen = 0;
            if (approvalsarr != "" && approvalsarr != undefined) {
                approvalsarr = approvalsarr.replace(/,/g, ";");
                appCDSID = approvalsarr.split(';')[0];
                applen = approvalsarr.split(';').length;
            }

            i++;
            let columna = '<tr>';
            columna += '<td class="text-center">' + value.ApprovalOrder + '</td>';
            if (applen > 1) {
                columna += '<td width="17%"><button class="btn btn-primary btn-sm" onclick="showApprovals(' + value.ApprovalOrder + ', ' + i + '); return false" id="linkApprovals' + value.ApprovalOrder + '"><span data-lang="linkApprovals"></span></button></td>';
            } else {
                columna += '<td></td>';
            }
            columna += '<td><input type="text" id="txtApproval' + i + '" class="form-control text-uppercase" onblur="OnChangeApproval(this)" /><span></span></td>';
            columna += '<td>' + value.Title + '</td>';
            columna += '</tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            arrayApprovals.push(GetPropertiesFor(DOMAIN365.replace(/#/g, '%23') + appCDSID + FORD).then((result) => {
                return result;
            }))
        });
    } else {

        arrOrd = response.d.results.sort(compareValues('ApprovalOrder'));
        let tabla = $('#approvalsSection').find('table');
        $(tabla).find('tbody tr').remove();

        let cont = 1;

        arrOrd.forEach((value) => {
            let approvalsarr = ""
            if (!isNullOrWhitespace(value.ApprovalCDSID)) {
                approvalsarr = value.ApprovalCDSID.toUpperCase();
            }

            let appCDSID = "";
            let applen = 0;
            if (approvalsarr != "" && approvalsarr != undefined) {
                approvalsarr = approvalsarr.replace(/,/g, ";");
                appCDSID = approvalsarr.split(';')[0];
                applen = approvalsarr.split(';').length;
            }


            let columna = '<tr>';
            columna += '<td class="text-center">' + value.ApprovalOrder + '</td>';
            if (applen > 1) { columna += '<td width="17%"><button class="btn btn-primary btn-sm" onclick="showApprovals(' + value.ApprovalOrder + ', ' + cont + '); return false" id="linkApprovals' + value.ApprovalOrder + '"><span data-lang="linkApprovals"></span></button></td>'; } else { columna += '<td></td>'; }
            columna += '<td><input type="text" id="txtApproval' + cont + '" class="form-control text-uppercase" onblur="OnChangeApproval(this)" /><span></span></td>';
            columna += '<td>' + value.ApprovalTitle + '</td>';
            columna += '</tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            arrayApprovals.push(GetPropertiesFor(DOMAIN365.replace(/#/g, '%23') + appCDSID + FORD).then((result) => {
                return result;
            }))

            cont++;
        });
    }

    loadLang($('#ddlLanguage').val().toLowerCase());

    const resolved = await Promise.all(arrayApprovals);
    return FillApprovalsDone(resolved, arrOrd, isJson);

}

async function FillApprovalsRamdon(response, isJson) {

    arrayApprovals = [];
    arrayAppCheck = [];
    let arrOrd;

    if (isJson) {
        arrOrd = JSON.parse(response);
        let tabla = $('#approvalsSection').find('table');
        $(tabla).find('tbody tr').remove();
        let i = 0;
        let cont = 1;
        arrOrd.forEach((value) => {
            let approvalsarr = "";
            if (!isNullOrWhitespace(value.Approval)) {
                approvalsarr = value.Approval.toUpperCase();
            }

            let appCDSID = "";
            let applen = 0;
            let appOrder;
            if (approvalsarr != "" && approvalsarr != undefined) {
                approvalsarr = approvalsarr.replace(/,/g, ";");
                appCDSID = approvalsarr.split(';')[0];
                applen = approvalsarr.split(';').length;
                appOrder = approvalsarr.ApprovalOrder;
            }

            i++;
            let columna = '<tr>';
            columna += '<td class="text-center">' + i + '</td>';
            if (applen > 1) { columna += '<td width="17%"><button class="btn btn-primary btn-sm" onclick="showApprovals(' + i + ', ' + cont + '); return false" id="linkApprovals' + i + '"><span data-lang="linkApprovals"></span></button></td>'; } else { columna += '<td></td>'; }
            columna += '<td><input type="text" id="txtApproval' + cont + '" class="form-control text-uppercase" onblur="OnChangeApproval(this)" /><span></span></td>';
            columna += '<td>' + value.Title + '</td></tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            arrayApprovals.push(GetPropertiesFor(DOMAIN365.replace(/#/g, '%23') + appCDSID + FORD).then((result) => {
                return result;
            }))
            cont++;
        });
    } else {
        arrOrd = response.d.results.sort(compareValues('ApprovalOrder'));
        let tabla = $('#approvalsSection').find('table');
        $(tabla).find('tbody tr').remove();

        let i = 0;
        arrOrd.forEach((value, index) => {
            let approvalsarr = "";
            if (!isNullOrWhitespace(value.ApprovalCDSID)) {
                approvalsarr = cleanCDSIDDomain(value.ApprovalCDSID.toString()).toUpperCase().trim();
            }
            let appCDSID = "";
            let applen = 0;
            let appOrder = value.ApprovalOrder;
            if (approvalsarr != "" && approvalsarr != undefined) {
                approvalsarr = approvalsarr.replace(/,/g, ";");
                appCDSID = approvalsarr.split(';')[0];
                applen = approvalsarr.split(';').length;
            }

            i++;
            let columna = '<tr>';
            columna += '<td class="text-center"> ' + appOrder + '</td>';
            if (applen > 1) { columna += '<td width="17%"><button class="btn btn-primary btn-sm" onclick="showApprovals(' + index + ', ' + (parseInt(index) + 1) + '); return false" id="linkApprovals' + index + '"><span data-lang="linkApprovals"></span></button></td>'; } else { columna += '<td></td>'; }
            columna += '<td><input type="text" id="txtApproval' + i + '" class="form-control text-uppercase" onblur="OnChangeApproval(this)"/><span></span></td>';
            columna += '<td>' + value.ApprovalTitle + '</td>';
            columna += '</tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            arrayApprovals.push(GetPropertiesFor(DOMAIN365.replace(/#/g, '%23') + appCDSID + FORD).then((result) => {
                return result;
            }));
        });
    }

    loadLang($('#ddlLanguage').val().toLowerCase());

    const resolved = await Promise.all(arrayApprovals);
    return FillApprovalsDone(resolved, arrOrd, isJson, true);

}

function GetNewSectionApproval(name, number) {
    let result = '';

    result += '<div class="card mb-2 w-100">';
    result += '<div class="card-header"><h2>' + name + '</h2></div>';
    result += '<div class="card-body card-body' + number + '">';
    result += '</div></div>';
    return result;
}

//TODO: Optimizar para compatibiliad de multilenguaje
function GetNewApproval(number) {
    let result = '';
    let lang = $('#ddlLanguage option:selected').val().trim();
    let lblAppDateAppRej = (lang === "ES" ? 'Fecha de Aprobación/Rechazo:' : 'Date of Approval/Rejection:');
    let lblAppCDSIDApproval = (lang === "ES" ? 'Gerente/Supervisor que Autorizará la solicitud:' : 'Manager/Supervisor Authorizing the request');
    let lblAppComment = (lang === "ES" ? 'Comentario del Aprobador:' : 'Approver Comment:');
    let lblbnlApproval = (lang === "ES" ? 'Aprobar' : 'Approve');
    let lblbtnReject = (lang === "ES" ? 'Rechazar' : 'Reject');

    result += '<div class="form-group row card-body' + number + '">';
    result += '<div class="col-md-3"><td col-md-3><span data-lang="AppCDSIDApproval" class="font-weight-bold">' + lblAppCDSIDApproval + '</span></div>';
    result += '<div class="col-md-3"><input type="text" id="txtApproval' + number + '" class="form-control txtApproval text-uppercase field-required" onblur="ChangeCDSIDApproval(this)">';
    result += '<span class="text-info"></span><input type="hidden" id="hdfApproval' + number + '" value=""></div>';
    result += '<div class="col-md-3"><td col-md-3><span class="text-info d-none"></span></div>';
    result += '<div class="col-md-3"><td col-md-3><span class="text-info d-none"></span></div>';
    result += '</div>';
    result += '<div class="form-group row divApproval' + number + ' isRead mb-0 d-none">';
    result += '<div class="col-md-3"><label class="font-weight-bold" data-lang="AppDateAppRej">' + lblAppDateAppRej + '</label></div>';
    result += '<div class="col-md-6" id="divDate' + number + '"><span class="text-info"></span></div>';
    result += '</div>';
    result += '<div class="form-group row divApproval' + number + ' isRead mb-0 d-none">';
    result += '<div class="col-md-12"><label class="font-weight-bold" data-lang="AppComment">' + lblAppComment + '</label>';
    result += '<textarea class="form-control" rows="3" id="txtCommentary' + number + '"></textarea></div>';
    result += '</div>';
    result += '<div class="form-group divApproval' + number + ' justify-content-center d-none">';
    result += '<div class="w-50 m-2"><button type="button" class="btn btn-success btn-block" onclick="ValidateApprover(this,' + number + ')">' + lblbnlApproval + ' <i class="fa fa-thumbs-up" aria-hidden="true"></i></button></div>';
    result += '<div class="w-50 m-2"><button type="button" class="btn btn-danger btn-block" onclick="ValidateReject(this,' + number + ')">' + lblbtnReject + ' <i class="fa fa-thumbs-down" aria-hidden="true"></i></button></div></div>';
    result += '</div>';
    result += '<div class="form-group row d-none divApproval' + number + '">';
    result += '<div class="col-md-12">';
    result += '<div class="alert" role="alert" id="msjApproval' + number + '"></div>';
    result += '</div>';
    result += '</div>';

    return result;
}

function SetLL6(GerenteCDSID, ctl) {
    FindLL6(GerenteCDSID, function (cdsid) {
        let arrayRequest = [];
        $('.txtRequest').each(function (i, objReq) {
            let valueApproval = objReq.value;
            arrayRequest.push(valueApproval.toUpperCase());
        });
        //if it is within the requestors, place his manager
        let mgr = cdsid.Email.split('@').shift().toUpperCase();
        CDSIDLL6 = isNullOrWhitespace(mgr) ? "" : mgr;
        if (arrayRequest.indexOf(CDSIDLL6) >= 0) {
            CDSIDLL6 = GetByProp(cdsid.UserProfileProperties.results, "Manager").split('|').pop().split('@')[0].toUpperCase();
        }

        $(ctl).val(CDSIDLL6);
        $(ctl).blur();
    });
}

function ValidateApprover(t, index) {
    Approver(index);
}

async function Approver(index, total, jsonApp) {

    try {

        let status;
        let createdBy = userLogin;
        let requestID = $('#lblID').text();
        let comments = $('#txtAppComments').val();
        let lang = $('#ddlLanguage option:selected').val().trim();

        let comm = '';
        let wocomm = '';
        if (isNullOrWhitespace(comments)) {
            GetValueByKey('lblwocomm', Language, function (data) { wocomm = data });
            comments = wocomm;
        } else {
            GetValueByKey('lblComments', Language, function (data) { comm = data });
            comments = `<br>${comm}: ${comments}`;
        }

        if (index < total) {
            status = "Approval" + (index + 1);
        }
        else {
            status = "Analyst";
        }

        let obj = {
            "__metadata": {
                "type": "SP.Data.UniversalRequestListItem"
            },
            "Status": status,
            "Approvals": jsonApp,
        };

        let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
        try {
            const response = await fetch(path, {
                method: 'POST',
                contentType: 'application/json;odata=verbose',
                data: JSON.stringify(obj),
                headers: MERGE
            });
            const data = await response.json();

            let subservice = $("#ddRequestType").val();

            //notification
            let reqCDSID = '';
            let requestors = [];
            $('#tblRequester').find('tbody tr').each(function () {
                requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
            });
            let _requestorsStr = '';
            if (requestors.length > 0) {
                _requestorsStr = requestors[0];
                for (let r = 1; r < requestors.length; r++) {
                    _requestorsStr += ',' + requestors[r];
                }
            }
            // if it is random approval flow do not send notification unless it is the last approver
            if (globalIsSec) {
                let CC = reqCDSID.split(';');
                CC = CC.filter(function (value) {
                    return value != "";
                });
                if (index < total) {
                    let _app = arrayJsonApprovals[index].Approval.split(';');
                    let _to = _app[0];
                    let _cc;
                    _app.shift();
                    _cc = _app;
                    _cc = _cc.concat(CC);
                    sendNotification(_to, _cc, 'Approval' + (index + 1), subservice, requestID, lang);
                }
                else {
                    let analyst = $('#lblResponsableAsignado').text();
                    analyst = analyst.replace("(", "").replace(")", "").trim();
                    backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                    CC = backupAnalyst.split(';');
                    if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                    sendNotification(_requestorsStr, [], 'RqsAnalystLvl', subservice, requestID, lang);
                    sendNotification(analyst, CC, ANALYST, subservice, requestID, lang);
                }
            } else {
                //Random approval flow
                //Send notificacation to requester 
                sendNotification(creatorCDSID, [], 'AppRandom', subservice, requestID, lang);
                //check if is the last to approve to send to the analyst
                let esUltimo = JSON.parse(jsonApp).filter(value => value.Date == null).length == 0;
                if (esUltimo) {
                    let analyst = $('#lblResponsableAsignado').text();
                    analyst = analyst.replace("(", "").replace(")", "").trim();
                    backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                    CC = backupAnalyst.split(';');
                    if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                    sendNotification(_requestorsStr, [], 'RqsAnalystLvl', subservice, requestID, lang);
                    sendNotification(analyst, CC, ANALYST, subservice, requestID, lang);
                }
            }
            //get button text from language
            let backText = '';
            GetValueByKey('lblbackText', lang, (val) => backText = val);
            let msj = '<div class="alert alert-success" role="alert">';
            let parametros = '';
            let num = getUrlParameter('num');
            let urlSiteCode = (getUrlParameter('SiteCode') !== undefined) ? '' : '?SiteCode=' + SiteCode;
            num = (num !== undefined) ? '&num=' + requestID : '';
            msj += '<h4 class="alert-heading"><span data-lang="MsjSuccess"></span></h4>';
            msj += '<p data-lang="RqstApproved"></p>';
            msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + num + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
            msj += '</div>';
            $('#main').remove();
            $('#GeneralMsj').append(msj);
            loadLang(lang);
            CreateLOG(requestID, createdBy, PHASE.APPROVE, comments);

            return data;
        } catch (e) {
            console.log(e);
            return e;
        }
    } catch (error) {
        console.log('error: ', error);
    }

}

async function ApproverRandom(objApp) {

    try {
        let status;
        let createdBy = userLogin;
        let requestID = $('#lblID').text();
        let comments = $('#txtAppComments').val();
        let lang = $('#ddlLanguage option:selected').val().trim();

        isNullOrWhitespace(comments) ? GetValueByKey('lblwocomm', Language, function (data) { comments = ' ' + data }) : GetValueByKey('lblComments', Language, function (data) { comments = `<br>${data}: ${comments}` });

        let filter = `ID eq ${requestID}`;
        try {
            const response = await GetListByIDPromise(LISTAUNIVERSALREQUEST, '', filter);
            let item = response.d.results;
            if (item.length > 0) {
                item = item[0];
                if (item.Status == REJECTED) {
                    let msj = '<div class="alert alert-warning" role="alert">';

                    msj += '<h4 class="alert-heading"><span data-lang="MsjWarning"></span></h4>';
                    msj += '<p data-lang="RqstAlreadyRejected"></p>';
                    msj += '</div>';


                    $('#main').remove();
                    $('#GeneralMsj').append(msj);
                    loadLang(lang);
                } else {
                    let approvals = JSON.parse(item.Approvals);

                    //-------------------------------------------------
                    //  mejora bloques aprobadores: envío de correo
                    //  al cambia de bloque
                    //-------------------------------------------------

                    let findBlocks = {};
                    let currentLevel = 0;
                    let currentUserLevel = 0;
                    let approvers_array = [];
                    let approvers_txt = '';

                    let mainApprovers = [];
                    let mainApprovers_txt = '';
                    let _secondaryApprovers = [];
                    let secondaryApprovers = [];

                    $.each(approvals, function (index, element) {

                        if (findBlocks[element.ApprovalOrder] == undefined && element.Date == null) {
                            findBlocks[element.ApprovalOrder] = [element];
                            if (Object.keys(findBlocks).length == 1) currentLevel = element.ApprovalOrder;
                        }
                        else if (element.Date == null) {
                            findBlocks[element.ApprovalOrder].push(element);
                        }

                        if (userLogin == element.Approval) currentUserLevel = element.ApprovalOrder;

                    });



                    if (findBlocks[currentLevel].length == 1) {

                        $.each(findBlocks[currentLevel + 1], function (index, element) {

                            $.each(element.Approval.split(';'), function (ind, item) {
                                approvers_array.push(item);
                            })
                        })
                    }

                    if (approvers_array.length > 0) {

                        $.each(approvals, function (index, element) {
                            if (element.ApprovalOrder == (currentLevel + 1)) {
                                //
                                if (element.Approval.split(';').length > 1) {
                                    mainApprovers.push(element.Approval.split(';')[0]);
                                    secondaryApprovers = element.Approval.split(';');
                                    secondaryApprovers.shift();
                                    _secondaryApprovers = _secondaryApprovers.concat(secondaryApprovers);
                                } else {
                                    mainApprovers.push(element.Approval);
                                }
                            }
                        });

                        mainApprovers_txt = JSON.stringify(mainApprovers);

                        while (mainApprovers_txt.replace('[', '').replace(']', '').includes('"')) {
                            mainApprovers_txt = mainApprovers_txt.replace('[', '').replace(']', '').replace('"', '')
                        }

                        sendNotification(mainApprovers_txt, _secondaryApprovers, 'Approval', $("#ddRequestType").val(), requestID, lang);
                    }

                    //-------------------------------------------------


                    for (let i = 0; i < approvals.length; i++) {
                        const element = approvals[i];

                        if (element.Approval.toUpperCase().indexOf(userLogin.toUpperCase().trim()) > -1 && element.Date == null) {
                            approvals[i].Approval = objApp.Approval;
                            approvals[i].Name = displayName;
                            approvals[i].Date = objApp.Date;
                            approvals[i].Comments = objApp.Comments;
                            break;

                        }
                    }
                    let sts = approvals.filter(value => value.Date == null);
                    let jsonApp = JSON.stringify(approvals);
                    let status = '';
                    sts.length > 0 ? status = "Approvals" : status = "Analyst";
                    let obj = {
                        "__metadata": {
                            "type": "SP.Data.UniversalRequestListItem"
                        },
                        "Status": status,
                        "Approvals": jsonApp,
                    };

                    let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
                    try {
                        const response = await fetch(path, {
                            method: 'POST',
                            contentType: 'application/json;odata=verbose',
                            data: JSON.stringify(obj),
                            headers: MERGE
                        });
                        const data = await response.json();

                        let subservice = $("#ddRequestType").val();

                        //notification
                        let reqCDSID = '';
                        let requestors = [];
                        $('#tblRequester').find('tbody tr').each(function () {
                            requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                            reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
                        });
                        let _requestorsStr = '';
                        if (requestors.length > 0) {
                            _requestorsStr = requestors[0];
                            for (let r = 1; r < requestors.length; r++) {
                                _requestorsStr += ',' + requestors[r];
                            }
                        }
                        //if it is random approval flow do not send notification unless it is the last approver
                        let CC = [];
                        if (globalIsSec) {
                            //notification
                            let reqCDSID = '';
                            $('#tblRequester').find('tbody tr').each(function () {
                                reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
                            });
                            CC = reqCDSID.split(';');
                            CC = CC.filter(function (value) {
                                return value != "";
                            });
                            if (index < total) {
                                let app = arrayJsonApprovals[index].Approval;
                                let emailApp = app.replace(/'/g, ';').split(';')[0];
                                sendNotification(emailApp, CC, 'Approval' + (index + 1), subservice, requestID, lang);
                            }
                            else {
                                let analyst = $('#lblResponsableAsignado').text();
                                analyst = analyst.replace("(", "").replace(")", "").trim();
                                backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                                CC = backupAnalyst.split(';');
                                if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                                sendNotification(_requestorsStr, [], 'RqsAnalystLvl', subservice, requestID, lang);
                                sendNotification(analyst, CC, ANALYST, subservice, requestID, lang);
                            }
                            //Fin notification
                        } else {
                            let _requestors = [];
                            $('#tblRequester').find('tbody tr').each(function () {
                                _requestors.push($(this).find('td:eq(0) input').val().toUpperCase());
                            });
                            sendNotification(creatorCDSID, [], 'AppRandom', subservice, requestID, lang);
                            let esUltimo = JSON.parse(jsonApp).filter(value => value.Date == null).length == 0;
                            if (esUltimo) {
                                let analyst = $('#lblResponsableAsignado').text();
                                analyst = analyst.replace("(", "").replace(")", "").trim();
                                backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                                CC = backupAnalyst.split(';');
                                if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                                $.each(_requestors, function (index, element) {
                                    CC.push(element);
                                });
                                sendNotification(_requestorsStr, [], 'RqsAnalystLvl', subservice, requestID, lang);
                                sendNotification(analyst, CC, ANALYST, subservice, requestID, lang);
                            } else {
                                sendNotification(creatorCDSID, [], 'AppRandom', subservice, requestID, lang);
                            }
                        }
                        //get button text from language
                        let backText = '';
                        GetValueByKey('lblbackText', lang, (val) => backText = val);
                        let msj = '<div class="alert alert-success" role="alert">';
                        let num = (getUrlParameter('num') !== null || getUrlParameter('num') !== undefined || getUrlParameter('num').length > 0) ? '&num=' + getUrlParameter('num') : '';
                        msj += '<h4 class="alert-heading"><span data-lang="MsjSuccess"></span></h4>';
                        msj += '<p data-lang="RqstApproved"></p>';
                        msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + num + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
                        msj += '</div>';
                        $('#main').remove();
                        $('#GeneralMsj').append(msj);
                        loadLang(lang);
                        CreateLOG(requestID, createdBy, PHASE.APPROVE, comments);

                        return data;
                    } catch (e) {
                        console.log(e);
                        return e;
                    }
                }
            }
        } catch (e) {
            console.log(e);
            return e;
        }
    } catch (e) {
        console.log('error: ', e);
    }
}

function ValidateReject(t, index) {

    let divApproval = $(t).closest('div').parent().parent();
    let comment = $(divApproval).find('textarea');

    $('#msjApproval' + index).text('');
    $('#msjApproval' + index).hide();

    if (comment.val() == '') {
        $('#msjApproval' + index).addClass('alert-danger');
        $('#msjApproval' + index).append('<strong>ERROR!</strong>&nbsp;<span data-lang="FillFields"></span>');
        $('#msjApproval' + index).show();
        $('#txtCommentary' + index).addClass('field-required is-invalid');
        loadLang($('#ddlLanguage').val().toLowerCase());
    }
    else {
        Rejection(index);
    }
}

async function Rejection() {

    try {

        globalJsonApp.map(value => {
            value.Date = null;
            value.Comments = null;
        });
        let createdBy = userLogin;
        let requestID = $('#lblID').text();
        let comments = $('#txtAppComments').val();

        let obj = {
            "__metadata": {
                "type": "SP.Data.UniversalRequestListItem"
            },
            "Status": REJECTED,
            "Approvals": JSON.stringify(globalJsonApp)
        };


        let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
        try {
            const response = await fetch(path, {
                method: 'POST',
                contentType: "application/json;odata=verbose",
                data: JSON.stringify(obj),
                headers: MERGE,
            });
            const data = await response.json();

            let subservice = $("#ddRequestType").val();
            let lang = $('#ddlLanguage option:selected').val().trim();
            sendNotification(creatorCDSID, [], REJECTED, subservice, requestID, lang);
            //get button text from language
            let backText = '';
            GetValueByKey('lblbackText', lang, (val) => backText = val);
            //Fin notification
            let msj = '<div class="alert alert-danger" role="alert">';
            let num = (getUrlParameter('num') !== null || getUrlParameter('num') !== undefined || getUrlParameter('num').length > 0) ? '&num=' + getUrlParameter('num') : '';
            msj += '<h4 class="alert-heading"><span data-lang="MsjReject"></span></h4>';
            msj += '<p data-lang="RqstReject"></p>';
            msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + num + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
            msj += '</div>';
            $('#main').remove();
            $('#GeneralMsj').append(msj);
            loadLang(lang);
            CreateLOG(requestID, createdBy, PHASE.REJECT, comments);

            return data;
        } catch (e) {
            console.log(e);
            return e;
        }
    } catch (error) {
        //error
        console.log('error: ', error);
    }

}

//Closure
async function SaveClosure() {

    let reqCDSID = '';
    let createdBy = userLogin;
    let requestID = $('#lblID').text();
    let typeUser;
    let commentsLog;
    let comments;
    let idControl;

    try {
        // will save requestors and analyst information
        // validate if the logged in user is requesting
        if (!$('#txtCommentsClosureRequest')[0].disabled) {
            comments = $('#txtCommentsClosureRequest').val();
            idControl = $('#txtCommentsClosureRequest');
        }
        if (!$('#txtCommentsClosureAnalyst')[0].disabled) {
            comments = $('#txtCommentsClosureAnalyst').val();
            idControl = $('#txtCommentsClosureAnalyst');
        }

        if (isNullOrWhitespace(comments)) {
            $('#msjClosing').text('');
            $('#msjClosing').addClass('alert-danger');
            let defaultText = '';
            let lang = $('#ddlLanguage option:selected').val().trim();
            GetValueByKey('FillFields', lang, (val) => defaultText = val);
            $('#msjClosing').append('<strong>' + defaultText + '</strong>');
            $('#msjClosing').show();
            $(idControl).addClass('field-required is-invalid');
        }
        else {
            let emailto = '';
            let backupAnalyst = '';


            if (creatorCDSID.toUpperCase() == userLogin.toUpperCase()) {
                // mejora bloques
                GetValueByKey('typeUserRequestor', lang, (val) => backText = val);
                typeUser = backText;
                //----------------------
                commentsLog = $('#txtCommentsClosureRequest').val();

                //TODO: implementar funcionalidad de envio a analistas
                let uniques = arrayOfAnalistas.filter((c, index) => {
                    return arrayOfAnalistas.indexOf(c) === index;
                });
                uniques.forEach((value) => emailto += value + ',');
                emailto = emailto.substr(0, emailto.length - 1);

                console.log('emailto ', emailto);
            }
            else if (arrayOfAnalistas.includes(userLogin)) {
                // mejora bloques
                GetValueByKey('typeUserAnalyst', lang, (val) => backText = val);
                typeUser = backText;
                //---------------
                commentsLog = $('#txtCommentsClosureAnalyst').val();
                emailto = creatorCDSID;
            }

            let jsonClosing = GetJSONClosure(false);

            $('#ctlForAnalyst input, #ctlForRequestor input').each(function () {
                //text, file, checkbox
                if ($(this).attr('type') == 'checkbox' || $(this).attr('type') == 'radio') {
                    if ($(this).is(':checked')) {
                        $(this).attr('checked', 'checked');
                    }
                } else {
                    $(this).attr('value', $(this).val());
                }
            });
            $('#ctlForAnalyst select, #ctlForRequestor select').each(function () {
                $(this).find('option:selected').attr('selected', 'selected');
            });

            let _ctlForAnalyst = $('#ctlForAnalyst').find('.card-body').html();
            let dato = '';
            if (_ctlForAnalyst !== undefined) { dato = _ctlForAnalyst.trim(); }
            let dato1 = $('#ctlForRequestor').find('.card-body').html().trim();

            let obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "Closing": jsonClosing,
                "DynamicFormAnalyst": isNullOrWhitespace(dato) ? "" : $('#ctlForAnalyst').html(),
                "DynamicFormRequester": isNullOrWhitespace(dato1) ? "" : $('#ctlForRequestor').html()
            };
            const _data = await GetListByID(url, LISTAUNIVERSALREQUEST, getUrlParameter('num'));

            if (_data.Status == $('#lblStatus').html()) {
                let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
                try {
                    const response = await fetch(path, {
                        method: 'POST',
                        contentType: 'application/json;odata=verbose',
                        data: JSON.stringify(obj),
                        headers: MERGE
                    });
                    const data = await response.json();

                    uploadFiles(requestID);
                    let subservice = $("#ddRequestType").val();

                    let lang = $('#ddlLanguage option:selected').val().trim();
                    sendNotification(emailto, [], 'SavedClosure', subservice, requestID, lang);
                    //Fin notification
                    //get button text from language
                    let backText = '';
                    GetValueByKey('lblbackText', lang, (val) => backText = val);
                    let msj = '<div class="alert alert-success" role="alert">';
                    let parametros = '';
                    let urlSiteCode = '?SiteCode=' + SiteCode;
                    if (getUrlParameter('num') === undefined) {
                        parametros = urlSiteCode + '&num=' + requestID;
                    }
                    else {
                        parametros = urlSiteCode + '&num=' + getUrlParameter('num');
                    }
                    msj += '<h4 class="alert-heading"><span data-lang="MsjCommClose"></span></h4>';
                    msj += '<p data-lang="RqstComments"></p>';
                    msj += '<br><a href="' + location.protocol + '//' + location.host + location.pathname + parametros + '" class="btn btn-primary" style="color:white">' + backText + '</a>';
                    msj += '</div>';
                    $('#main').remove();
                    $('#GeneralMsj').append(msj);
                    loadLang(lang);
                    CreateLOG(requestID, createdBy, PHASE.COMMENTS, commentsLog, typeUser);

                    return data;
                } catch (e) {
                    console.log(e);
                    return e;
                }
            } else {
                let wrongStatusTxt = '';
                GetValueByKey('wrongStatus', 'en', (val) => wrongStatusTxt = val);
                alert(wrongStatusTxt);
                location.reload();
            }
        }
    } catch (error) {
        //error
        console.log('error: ', error);
    }

}

async function ClosedClosure() {
    let reqCDSID = '';
    let createdBy = userLogin;
    let requestID = $('#lblID').text();
    let building = $('#ddBuilding option:selected').text().split('-').shift();
    let service = $('#ddArea option:selected').text();
    let requestType = $('#ddRequestType option:selected').text();
    let emailto = '';

    try {

        // will save applicants and analyst information
        let comments = $('#txtCommentsClosureAnalyst').val();
        if (isNullOrWhitespace(comments)) {
            $('#msjClosing').text('');
            $('#msjClosing').addClass('alert-danger');
            //TODO: Cambiar a archivo de idiomas
            //FillFields
            let errorTxt;//bloques
            GetValueByKey('FillFields', $('#ddlLanguage').val(), (val) => errorTxt = val);//bloques
            $('#msjClosing').append(`<strong>ERROR!</strong> <span data-lang="FillFields">${errorTxt}</span>`);//bloques
            $('#msjClosing').show();
            $('#txtCommentsClosureAnalyst').addClass('field-required is-invalid');
        }
        else {
            let commentsLog = $('#txtCommentsClosureAnalyst').val();
            let jsonClosing = GetJSONClosure(true);

            //new section for validating require fields
            let flag = false;
            $('.field-required:visible').each((i, v) => {
                if (isNullOrWhitespace($(v).val())) {

                    let msjErr = '';
                    GetValueByKey('FillFields', $('#ddlLanguage').val().toLowerCase(), (val) => msjErr = val);

                    $('#msjClosing').text('');
                    $('#msjClosing').addClass('alert-danger');
                    $('#msjClosing').append("<strong>ERROR!</strong> <span data-lang='FillFields'>" + msjErr + "</span>");
                    $('#msjClosing').show();

                    $(v).addClass('is-invalid');

                    $('.field-required').on('blur change', function () {
                        $(this).removeClass('is-valid');
                        $(this).removeClass('is-invalid');
                        if ($(this).val() == "" || $(this).val() == undefined) {
                            $(this).addClass('is-invalid');
                        } else {
                            $(this).addClass('is-valid');
                        }
                    });

                    flag = true;
                }
            });

            if (flag) return;

            $('#ctlForAnalyst input, #ctlForRequestor input').each(function () {
                //text, file, checkbox
                if ($(this).attr('type') == 'checkbox' || $(this).attr('type') == 'radio') {
                    if ($(this).is(':checked')) {
                        $(this).attr('checked', 'checked');
                    }
                } else {
                    $(this).attr('value', $(this).val());
                }
            });

            $('#ctlForAnalyst select, #ctlForRequestor select').each(function () {
                $(this).find('option:selected').attr('selected', 'selected');
            });

            let _ctlForAnalyst = $('#ctlForAnalyst').find('.card-body').html();
            let dato = '';
            if (_ctlForAnalyst !== undefined) { dato = _ctlForAnalyst.trim(); }
            let dato1 = ($('#ctlForRequestor').find('.card-body').html() !== undefined) ? $('#ctlForRequestor').find('.card-body').html().trim() : '';

            let obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "Closing": jsonClosing,
                "DynamicFormAnalyst": isNullOrWhitespace(dato) ? "" : $('#ctlForAnalyst').html(),
                "DynamicFormRequester": isNullOrWhitespace(dato1) ? "" : $('#ctlForRequestor').html(),
                "Status": SURVEY
            };

            const _data = await GetListByID(url, LISTAUNIVERSALREQUEST, getUrlParameter('num'));

            if (_data.Status == $('#lblStatus').html()) {
                let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID}`;
                try {
                    const response = await fetch(path, {
                        method: 'POST',
                        data: JSON.stringify(obj),
                        headers: MERGE
                    });
                    const data = await response.json();

                    uploadFiles(requestID);
                    let subservice = $("#ddRequestType").val();
                    let uniques = arrayOfAnalistas.filter((c, index) => {
                        return arrayOfAnalistas.indexOf(c) === index;
                    });
                    uniques.forEach((value) => emailto += value + ',');
                    emailto = emailto.substr(0, emailto.length - 1);
                    let lang = $('#ddlLanguage option:selected').val().trim();
                    let requestors = GetRequesters();
                    let requestors_string = '';
                    requestors_string += requestors[0];
                    for (let r = 1; r < requestors.length; r++) {
                        requestors_string += ',' + requestors[r];
                    }
                    sendNotification(requestors_string, [], 'SavedClosureRequestor', subservice, requestID, lang);
                    //get button text from language
                    let backText = '';
                    GetValueByKey('lblbackText', lang, (val) => backText = val);
                    let urlSiteCode = '?SiteCode=' + SiteCode;
                    let parameters = (getUrlParameter('num') !== undefined) ? urlSiteCode + '&num=' + requestID : urlSiteCode;
                    //New implementation of multilanguage message
                    let msj = '<div class="alert alert-success" role="alert">' +
                        '<h4 class="alert-heading"><span data-lang="lblReqClosure"></span></h4>' +
                        '<p><span data-lang="msjClosure"></span></p>' +
                        '<br><a href="' + location.protocol + '//' + location.host + location.pathname + parameters + '" class="btn btn-primary" style="color:white">' + backText + '</a>' +
                        '</div>'
                        ;
                    CreateLOG(requestID, createdBy, PHASE.CLOSING, commentsLog, null);
                    $('#main').remove();
                    $('#GeneralMsj').append(msj);
                    loadLang(lang);

                    return data;
                } catch (e) {
                    console.log(e);
                    return e;
                }
            }
        }
    } catch (error) {
        console.log('error: ', error);
    }
}

async function CancelClosure() {
    let reqCDSID = '';
    let createdBy = userLogin;
    let requestID = $('#lblID').text();
    let typeUser;
    let lang = $('#ddlLanguage option:selected').val().trim();

    try {

        let comments = $('#txtCommentsClosureAnalyst').val();
        if (isNullOrWhitespace(comments)) {
            $('#msjClosing').text('');
            $('#msjClosing').addClass('alert-danger');
            let errorTxt = '';//bloques
            GetValueByKey('FillFields', $('#ddlLanguage').val(), (val) => errorTxt = val);//bloques
            $('#msjClosing').append(`<strong>ERROR!</strong> ${errorTxt}`);//bloques
            $('#msjClosing').show();
            $('#txtCommentsClosureAnalyst').addClass('field-required is-invalid');
        }
        else {
            let commentsLog = $('#txtCommentsClosureAnalyst').val();
            let jsonClosing = GetJSONClosure(true);
            let obj = {
                "__metadata": {
                    "type": "SP.Data.UniversalRequestListItem"
                },
                "Closing": jsonClosing,
                "Status": CANCELLED
            };
            let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
            try {
                const response = await fetch(path, {
                    method: 'POST',
                    contentType: 'application/json;odata=verbose',
                    data: JSON.stringify(obj),
                    headers: MERGE
                });
                const data = await response.json();

                let subservice = $("#ddRequestType").val();
                //notification
                let analyst = $('#lblResponsableAsignado').text();
                analyst = analyst.replace("(", "").replace(")", "").trim() + ";";
                let CC = analyst.split(';');
                backupAnalyst = $('#lblAnalistasAsignados').text() + ';' + analyst;
                CC = backupAnalyst.split(';');
                if (isNullOrWhitespace(CC) || CC == "undefined") { CC = [] };
                sendNotification(creatorCDSID, CC, CANCELLED, subservice, requestID, lang);
                //Fin notification
                let urlSiteCode = '?SiteCode=' + SiteCode;
                let parameters = (getUrlParameter('num') !== undefined) ? urlSiteCode + '&num=' + requestID : urlSiteCode;
                //get button text from language
                let backText = '';
                GetValueByKey('lblbackText', lang, (val) => backText = val);
                //New implementation of multilanguage message
                let msj = '<div class="alert alert-danger" role="alert">' +
                    '<h4 class="alert-heading"><span data-lang="lblReqCancelled"></span></h4>' +
                    '<p><span data-lang="msjCancelled"></span></p>' +
                    '<br><a href="' + location.protocol + '//' + location.host + location.pathname + parameters + '" class="btn btn-primary" style="color:white">' + backText + '</a>' +
                    '</div>'
                    ;
                CreateLOG(requestID, createdBy, PHASE.CANCELLING, commentsLog, null);

                $('#main').remove();
                $('#GeneralMsj').append(msj);
                loadLang(lang);

                return data;
            } catch (e) {
                console.log(e);
                return e;
            }
        }
    } catch (error) {
        //error
        console.log('error: ', error);
    }
}

function GetJSONClosure(reqDate) {

    let json;
    let arrayOfJSON = {};
    let dateNow = "";
    try {
        if (reqDate) {
            dateNow = new Date().toLocaleString();
        }
        arrayOfJSON['commentsRequest'] = $('#txtCommentsClosureRequest').val();
        arrayOfJSON['commentsAnalyst'] = $('#txtCommentsClosureAnalyst').val();
        arrayOfJSON['dateClosure'] = dateNow;

        return JSON.stringify(arrayOfJSON);

    } catch (error) {
        console.log(error);
    }
}

function IsReqEqApp() {

    let arrayControls = [];
    let isButtonDisabled = false;

    $('.txtRequest ').each(function (i, objReq) {
        $('[id^="txtApproval"]').each(function (i, objApp) {
            if (objReq.value.toUpperCase() == objApp.value.toUpperCase()) {
                arrayControls.push("#" + objApp.id);
                isButtonDisabled = true;
            }
            else {
                GetFillReqDataApproval(objApp.id, objApp.value.toUpperCase());
                $("#" + objApp.id).next('span').addClass('text-info').removeClass('text-danger');
            }
        });
    });

    arrayControls.forEach(function (element, index) {
        ClearReqDataApproval(element);
        let msj = '';
        GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
        $(element).next('span').empty().text(msj);
        $(element).next('span').addClass('text-danger').removeClass('text-info');
        $(element).addClass('is-invalid').removeClass('is-valid');
    });

    if (isButtonDisabled) {
        $('#btnSubmit').attr('disabled', 'disabled');
        $('#btnSaveAdmin').attr('disabled', 'disabled');
    }
    else {
        $('#btnSubmit').removeAttr('disabled');
        $('#btnSaveAdmin').removeAttr('disabled');
    }
}

async function isLL6() {

    let arrApprovals = [];
    let msj = '';
    GetValueByKey('msjApproverLL6', $('#ddlLanguage option:selected').val(), function (v) { msj = v; });

    $('.txtApproval').each(async function (i, objApp) {
        let control = "#" + objApp.id;
        let num = Number(control.slice(-1));
        let noIsLL6OrMore = false;

        //FillNewCDSIDApproval
        if (!isNullOrWhitespace($("#" + objApp.id).val())) {
            let username = domain + $("#" + objApp.id).val() + FORD;
            arrApprovals.push($(control).val().toUpperCase());
            try {
                const response = await GetPropertiesFor(username);
                let mr = GetByProp(response.d.UserProfileProperties.results, "ManagerRole");
                noIsLL6OrMore = mr == "N" || isNullOrWhitespace(mr);

                let valueArray = isNullOrWhitespace(arrayDefaultApprovals[num - 1]) ? "" : arrayDefaultApprovals[num - 1];
                let valApproval = isNullOrWhitespace(arrApprovals[num - 1]) ? "" : arrApprovals[num - 1];
                if (!isNullOrWhitespace(valueArray) && noIsLL6OrMore && (valueArray.toUpperCase() != valApproval || (arrayDefaultApprovals.indexOf(objApp.value.toUpperCase()) == -1))) {
                    ClearReqDataApproval(control);
                    $(control).next('span').empty().text(msj);
                    $(control).next('span').addClass('text-danger').removeClass('text-info');
                    $('#btnSubmit').attr('disabled', 'disabled');
                    $('#btnSaveAdmin').attr('disabled', 'disabled');
                    return;
                }
            } catch (e) {
                console.log(e);
                return e;
            }
        }
    });
}

function lastRequestor() {
    let lastRequest = $('#tblRequester tbody tr:last').find('td > input').val();
    lastRequest = domain + lastRequest + FORD;
    SetLL6(lastRequest);
}

function CDSIDDuplicates(isDelete) {

    if (isDelete == undefined) {
        isDelete = false;
    }
    let arrayRequestduplicates = [];
    $('.txtRequest').each(function (i, objReq) {

        let control = $(".txtRequest:eq(" + i + ")");

        let value = objReq.value.toUpperCase();
        if (arrayRequestduplicates.indexOf(value) >= 0) {
            //existe duplicados
            ClearReqData(control);
            $(control).removeClass('is-valid');
            $(control).next('span').empty().text('The CDSID is duplicated');
            $(control).next('span').addClass('text-danger').removeClass('text-info');
            return;
        }
        else {
            arrayRequestduplicates.push(objReq.value.toUpperCase());
        }
    });

    if (isDelete) {
        $('.txtRequest').each(function (i, objReq) {
            let control = $(".txtRequest:eq(" + i + ")");
            ChangeCDSID(control);
        });
    }
}

async function GetAdmins(building, service) {
    try {
        arrayAdministrators = [];
        building == undefined ? building = "" : building = building;
        subservice = 'ADMIN';
        let filtro = `Building eq '${building}' and Title eq 'IT' and SubServicio eq '${subservice}'`;
        const data = await GetListByQuery(url, LISTAITSERVICES, filtro, "");
        let analista;
        let backup;
        if (data.d.results.length > 0) {
            analista = data.d.results[0].Analista;
            backup = data.d.results[0].Email_Analista;
            if (analista != "" && analista != undefined) {
                analista = analista.indexOf('\\') > -1 ? analista.split('\\')[1] : analista;
                arrayAdministrators.push(analista);
            }
            if (backup != "" && backup != undefined) {
                backup = backup.replace(",", ";");
                backup = backup.indexOf('\\') > -1 ? backup.split('\\')[1] : backup;
                arrayAdministrators.push(backup);
            }
        }
    } catch (error) {
        console.log('error: ', error);
    }
}

function GetAdministrators(building, service) {
    try {
        arrayAdministrators = [];
        building == undefined ? building = "" : building = building;
        subservice = 'ADMIN';
        let filtro = `Building eq '${building}' and Title eq 'IT' and SubServicio eq '${subservice}'`;
        return GetListByIDPromise(LISTAITSERVICES, "", filtro);
    } catch (error) {
        console.log('error: ', error);
    }
}

function ValidateSaveAdmin() {
    let commentJustification = $('#txtAdminJustification').val();

    if (isNullOrWhitespace(commentJustification)) {
        $('#msjAdmin').addClass('alert-danger');
        let errorTxt;//bloques
        GetValueByKey('FillFields', $('#ddlLanguage').val(), (val) => errorTxt = val);//bloques
        $('#msjAdmin').append(`<strong>ERROR!</strong> <span data-lang="FillFields">${errorTxt}</span>`);//bloques
        $('#msjAdmin').show();
        $('#txtAdminJustification').addClass('field-required is-invalid');
    }
    else {
        let global = true;
        $('[id^="txtApproval"]').each(function (index, element) {
            if ($(this).next('span').text().indexOf('CDSID doesn\'t exist') > -1) {
                global = false;
                msjError = ' <span data-lang="CdsidError"></span>';
                $(this).addClass('is-invalid').removeClass('is-valid');
            }
        });

        let msj = '';
        GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });

        $('[id^="txtApproval"]').each(function (index, element) {
            let label = $(this).next('span');
            if ($(label).text().indexOf('The CDSID must be from an LL6+') > -1 ||
                $(label).text().indexOf(msj) > -1) {
                global = false;
                msjError = ' <span data-lang="IncorrectApp"></span>';
            }
        });

        if (!global) {
            $('#msjGeneral').addClass('alert-danger');
            $('#msjGeneral').append("<strong>ERROR!</strong>&nbsp;" + msjError);
            loadLang($('#ddlLanguage').val().toLowerCase());
            return false;
        }
        SaveAdmin();
    }
}

async function SaveAdmin() {

    let lang = $('#ddlLanguage option:selected').val().trim();

    try {

        let createdBy = userLogin;
        let requestID = $('#lblID').text();
        let commentJustification = $('#txtAdminJustification').val();
        let obj = {
            "__metadata": {
                "type": "SP.Data.UniversalRequestListItem"
            },
            "Analysts": GetJSONAnalysts(),
            "Approvals": UpdateJSONApprovals(),
        };

        let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
        try {
            const response = await fetch(path, {
                method: 'POST',
                contentType: "application/json;odata=verbose",
                data: JSON.stringify(obj),
                headers: MERGE
            });
            const data = await response.json();

            let subservice = $("#ddRequestType").val();
            let reqCDSID = '';
            $('#tblRequester').find('tbody tr').each(function () {
                reqCDSID += $(this).find('td:eq(0) input').val().toUpperCase() + ";";
            });
            let CC = reqCDSID.split(';');
            CC = CC.filter(function (value) {
                return value != "";
            });
            sendNotification(creatorCDSID, CC, ADMIN, subservice, requestID, lang);
            CreateLOG(requestID, createdBy, PHASE.CHANGE, commentJustification, null);
            //get button text from language
            let backText = '';
            GetValueByKey('lblbackText', lang, (val) => backText = val);
            let urlSiteCode = (getUrlParameter('SiteCode') !== undefined) ? '' : '?SiteCode=' + SiteCode;
            let msj =
                '<div class="alert alert-success" role="alert">'
            '<h4 class="alert-heading"><span data-lang="lblSuccess"></span></h4>'
            '<p><span data-lang="msjAdmChanges"></span></p>'
            '<br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + '&num=' + requestID + '" class="btn btn-primary" style="color:white">' + backText + '</a>'
            '</div>'
                ;
            $('#main').remove();
            $('#GeneralMsj').append(msj);
            loadLang(lang);

            return data;
        } catch (e) {
            console.log(e);
            return e;
        }
    } catch (error) {
        console.log('error: ', error);
    }

}

async function PeoplePicker(id, ctl) {
    if (id != "") {
        let user = id;
        ctl = ctl.toString().length == 5 ? "0" + ctl : ctl;
        try {
            const response = await GetPeoplePicker(user);
            if (response.d.UserProfileProperties == undefined) {
                $('#span_' + ctl).text('CDSID doesn\'t exist');
                $('#span_' + ctl).addClass('text-danger').removeClass('text-info');
                $('#cdsid_' + ctl).addClass('is-invalid').removeClass('is-valid');
            } else {
                result = response.d.DisplayName + ' - ' + GetByProp(response.d.UserProfileProperties.results, "EmployeeType");
                $('#span_' + ctl).empty().text(result);
                $('#span_' + ctl).addClass('text-info').removeClass('text-danger');
                $('#cdsid_' + ctl).addClass('is-valid').removeClass('is-invalid');
            }
        } catch (e) {
            console.log(e);
            return e;
        }
    }
    else {
        $('#span_' + ctl).empty().text('');
        $('#cdsid_' + ctl).removeClass('is-invalid is-valid');
    }
}

async function GetPeoplePicker(user) {
    let path = `${getHostName()}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${domain}${user}${FORD}'`;
    try {
        const response = await fetch(path, {
            headers: ACCEPT
        });
        const data = await response.json();

        return data;
    } catch (e) {
        console.log(e);
        return e;
    }
}

function getPDF(filename, requestID, callback) {

    let HTML_Width = $("#main").width();
    let HTML_Height = $("#main").height();
    let top_left_margin = 15;
    let PDF_Width = HTML_Width + (top_left_margin * 2);
    let PDF_Height = (PDF_Width * 1.5) + (top_left_margin * 2);
    let canvas_image_width = HTML_Width;
    let canvas_image_height = HTML_Height + top_left_margin;

    let totalPDFPages = Math.ceil(HTML_Height / PDF_Height) - 1;

    try {
        html2canvas(document.querySelector('#main')).then(function (canvas) {

            canvas.getContext('2d');

            let imgData = canvas.toDataURL("image/jpeg", 1.0);
            let pdf = new jsPDF('p', 'pt', [PDF_Width, PDF_Height]);
            pdf.addImage(imgData, 'JPG', top_left_margin, top_left_margin, canvas_image_width, canvas_image_height);

            for (let i = 1; i <= totalPDFPages; i++) {
                pdf.addPage(PDF_Width, PDF_Height);
                pdf.addImage(imgData, 'JPG', top_left_margin, -(PDF_Height * i) + (top_left_margin * 2.1), canvas_image_width, canvas_image_height);
            }

            uploadAttachment(pdf, filename, requestID);
            callback(true);

        });
    } catch (error) {
        callback(false);
    }
};

async function uploadAttachment(doc, filename, requestID) {

    let blob = doc.output('blob');
    let arrayBuffer;
    let fileReader = new FileReader();
    fileReader.onload = async function () {
        arrayBuffer = this.result;
        let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})/AttachmentFiles/add(FileName='${filename}')`;
        try {
            const response = await fetch(path, {
                method: 'POST',
                data: arrayBuffer,
                processData: false,
                headers: POST,
            });
            const data = await response.json();

            return data;
        } catch (e) {
            console.log(e);
            return e;
        }
    };
    fileReader.readAsArrayBuffer(blob);
}

async function GetAttachmentsToDelete(ItemId, callback) {
    let path = `${url}/_api/web/lists/GetByTitle('${LISTAUNIVERSALREQUEST}')/GetItemById(${ItemId})/AttachmentFiles`;
    try {
        const response = await fetch(path, {
            headers: ACCEPT
        });
        const data = await response.json();

        callback(data);
    } catch (e) {
        console.log(e);
        callback(false);
        return e;
    }
}

async function DeleteItemAttachment(ItemId, FileTitle) {
    let path = `${url}/_api/web/lists/GetByTitle('${LISTAUNIVERSALREQUEST}')/GetItemById(${ItemId})/AttachmentFiles/getByFileName('${FileTitle}')`;
    try {
        const response = await fetch(path, {
            method: 'POST',
            headers: {
                'X-RequestDigest': DIGEST,
                'X-HTTP-Method': 'DELETE',
                'Accept': 'application/json;odata=verbose',
                "If-Match": "*"
            }
        });
        const data = await response.json();

        return data;
    } catch (e) {
        console.log(e);
        return e;
    }
}

async function cancelAdmin() {

    let lang = $('#ddlLanguage').val();
    let commentJustification = $('#txtAdminJustification').val();
    if (isNullOrWhitespace(commentJustification)) {
        let error = '';
        GetValueByKey('FillFields', $('#ddlLanguage').val(), (v) => error = v);

        $('#msjAdmin').addClass('alert-danger');
        $('#msjAdmin').append(`<strong>ERROR!</strong> <span data-lang="FillFields">${error}</span>`);
        $('#msjAdmin').show();
        $('#txtAdminJustification').addClass('field-required is-invalid');
    } else {

        let cancelAlert = '';
        let yes = '';
        GetValueByKey('alertCancel', lang, (v) => cancelAlert = v);
        GetValueByKey('lblYesNo', lang, (v) => yes = v);
        //lang

        bootbox.confirm({
            title: '',
            size: 'md',
            message: cancelAlert,
            async: false,
            buttons: {
                confirm: { label: yes },
                cancel: { label: 'No' },
            },
            callback: async function (result) {
                if (result) {
                    let createdBy = userLogin;
                    let requestID = $('#lblID').text();
                    let commentJustification = $('#txtAdminJustification').val();
                    let obj = {
                        "__metadata": {
                            "type": "SP.Data.UniversalRequestListItem"
                        },
                        "Status": CANCELLED,
                        "Analysts": GetJSONAnalysts(),
                        "Approvals": UpdateJSONApprovals(),
                    };

                    let path = `${url}/_api/web/lists/getbytitle('${LISTAUNIVERSALREQUEST}')/items(${requestID})`;
                    try {
                        const response = await fetch(path, {
                            method: 'POST',
                            contentType: 'application/json;odata=verbose',
                            data: JSON.stringify(obj),
                            headers: MERGE
                        });
                        const data = await response.json();

                        let subservice = $("#ddRequestType").val();
                        sendNotification(creatorCDSID, [], CANCELLED, subservice, requestID, lang);
                        CreateLOG(requestID, createdBy, PHASE.CANCELLING, commentJustification, null);
                        //get button text from language
                        let backText = '';
                        GetValueByKey('lblbackText', lang, (val) => backText = val);
                        let urlSiteCode = (getUrlParameter('SiteCode') !== undefined) ? '' : '?SiteCode=' + SiteCode;
                        let msj = '<div class="alert alert-success" role="alert">\
                            <h4 class="alert-heading"><span data-lang="lblReqCancelled"></span></h4>\
                            <p><span data-lang="RqstCancel"></span></p>\
                            <br><a href="' + location.protocol + '//' + location.host + location.pathname + '?SiteCode=' + SiteCode + '&num=' + requestID + '" class="btn btn-primary" style="color:white">${backText}</a>\
                            </div>';
                        $('#main').remove();
                        $('#GeneralMsj').append(msj);
                        loadLang(lang);

                        return data;
                    } catch (e) {
                        console.log(e);
                        return e;
                    }
                }
            }
        });
    }

}

async function showAnalyst() {

    let analista;
    let backup;
    let arrOrd;
    let building = $('#ddBuilding').val();
    let service = $('#ddArea').val();
    let subservice = $('#ddRequestType').val();

    let tabla = $('#mdl_analysts').find('table');
    $(tabla).find('tbody tr').remove();

    let i = 1;

    //numero de solicitud
    let i_itemid = getUrlParameter("num");
    i_itemid = (typeof i_itemid === 'undefined') ? 0 : i_itemid;

    if (i_itemid > 0) {
        const data = await GetListByID(url, LISTAUNIVERSALREQUEST, i_itemid);
        let jsonAnalysts = JSON.parse(cleanCDSIDDomain(data.Analysts.toString()));
        backup = jsonAnalysts[0].backup;
        if (backup != "" && backup != undefined) { backup = backup.replace(",", ";"); }
        arrOrd = cleanArray(backup.split(';'), "");
        arrOrd.forEach((value) => {
            analista = value.indexOf('\\') > -1 ? value.split('\\')[1] : value;
            analista = analista.toUpperCase();
            let columna = '<tr>';
            columna += '<td class="text-left"  ><span id="lblAnalystEmail' + i + '">(' + analista + ')</span> <span id="lblAnalyst' + i + '"></span></td>';
            columna += '</tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            GetPeopleName(analista, 'lblAnalyst' + i)
            i++;
        });
    }
    else {
        let filtro = "Building eq '" + building + "' and Title eq '" + service + "' and SubServicio eq '" + subservice + "'";
        const response = await GetListByQuery(url, LISTAITSERVICES, filtro, "");

        backup = response.d.results[0].Email_Analista;
        if (backup != "" && backup != undefined) { backup = backup.replace(",", ";"); }
        $('#lblAnalistasAsignados').text(backup);
        arrOrd = cleanArray(backup.split(';').sort(compareValues('Email_Analista')), "");
        arrOrd.forEach((value) => {
            analista = value.indexOf('\\') > -1 ? value.split('\\')[1] : value;
            analista = analista.toUpperCase();
            let columna = '<tr>';
            columna += '<td class="text-left"  ><span id="lblAnalystEmail' + i + '">(' + analista + ')</span> <span id="lblAnalyst' + i + '"></span></td>';
            columna += '</tr>';
            $(tabla).find('tbody').append($.parseHTML(columna));
            GetPeopleName(analista, 'lblAnalyst' + i)
            i++;
        });
    }

    $('#mdl_analysts').modal("show");
}

function ClearAnalysts() {
    $('#linkAnalyst').hide();
    $('#lblAnalistasAsignados').text('');
    let tabla = $('#mdl_analysts').find('table');
    $(tabla).find('tbody tr').remove();
}

function cleanArray(obj, cadena) {
    for (let i = 0, j = obj.length; i < j; i++) {
        if (obj[i] == cadena) {
            obj.splice(i, 1);
            i--;
        }
    }
    return obj;
};

async function showApprovals(orden, index) {
    let approvalarray;
    let approvalId;
    let arrOrd;
    let building = $('#ddBuilding').val();
    if (building.indexOf('-') > 0) { building = building.split('-')[0]; }
    let service = $('#ddArea').val();
    let subservice = $('#ddRequestType').val();

    let tabla = $('#mdl_changeApproval').find('table');
    $(tabla).find('tbody tr').remove();

    let filtro = "Title eq '" + building + "' and Servicio eq '" + service + "' and Subservicio eq '" + subservice + "'";
    let indexVal = index;
    const response = await GetListByQuery(url, LISTAAPPROVALS, filtro, "");
    // Mejora bloques (aprobadores backup button)
    let ordApprovers = response.d.results.sort((a, b) => parseFloat(a.ApprovalOrder) - parseFloat(b.ApprovalOrder));
    approvalarray = ordApprovers[index - 1].ApprovalCDSID;
    //-----------------------
    if (approvalarray != "" && approvalarray != undefined) { approvalarray = approvalarray.replace(/,/g, ";").replace(/;;/g, ";"); }
    arrOrd = cleanArray(approvalarray.split(';'), "");
    let i = 1;
    arrOrd.forEach((value) => {
        approvalId = value.toUpperCase();
        let columna = '<tr>';
        columna += '<td style="width:20%"><button class="btn btn-primary btn-sm" onclick="changeApprovals(\'' + approvalId + '\',\'' + index + '\'); return false;" id="linkApprovals' + i + '"><span data-lang="linkAppSelect"></span></button></td>';
        columna += '<td style="width:80%"class="text-left"  ><span id="lblApprovalEmail' + i + '">(' + approvalId + ')</span> <span id="lblApp' + i + '"></span></td>';
        columna += '</tr>';
        $(tabla).find('tbody').append($.parseHTML(columna));
        GetPeopleName(approvalId, 'lblApp' + i)
        i++;
    });
    loadLang($('#ddlLanguage').val().toLowerCase());

    $('#mdl_changeApproval').modal("show");
}

async function changeApprovals(appid, orden) {
    appid = appid.toUpperCase();
    let arrOrd;
    let building = $('#ddBuilding').val();
    if (building.indexOf('-') > 0) { building = building.split('-')[0]; }
    let service = $('#ddArea').val();
    let subservice = $('#ddRequestType').val();

    let i = 1;
    let filtro = "Title eq '" + building + "' and Servicio eq '" + service + "' and Subservicio eq '" + subservice + "'";
    const resp = await GetListByQuery(url, LISTAAPPROVALS, filtro, "");
    arrOrd = resp.d.results;
    arrOrd.forEach(async (value) => {
        if (i == orden) {
            let req = GetRequesters();
            let label = $('#txtApproval' + orden).next('span');
            let userApproval = DOMAIN365.replace(/#/g, '%23') + appid + FORD;
            $('#txtApproval' + orden).val(appid);
            if (isNullOrWhitespace(appid) && value.MustBeLL6) {
                SetLL6(userName, $('#txtApproval' + orden));
            }

            try {
                const response = await GetPropertiesFor(userApproval);
                objGetApproval = response.d;
                $('#txtApproval' + orden).data('config', JSON.stringify(value));
                $('#txtApproval' + orden).data('name', objGetApproval.DisplayName);
                if (req.indexOf(!isNullOrWhitespace(appid) ? appid.toUpperCase() : appid) > -1) {
                    let msj = '';
                    GetValueByKey('msjApproverErr', $('#ddlLanguage option:selected').val(), function (v) { msj = v });
                    $(label).html(msj);
                    $(label).addClass('text-danger').removeClass('text-info');
                    $('#txtApproval' + orden).addClass('is-invalid').removeClass('is-valid');
                } else {
                    $('#txtApproval' + orden).next('span').empty().text(objGetApproval.DisplayName);
                    $(label).addClass('text-info').removeClass('text-danger');
                    $('#txtApproval' + orden).addClass('is-valid').removeClass('is-invalid');
                    $('#btnSubmit').removeAttr('disabled');
                }
            } catch (e) {
                return e;
            }
        }
        i++;
    });
    $('#mdl_changeApproval').modal("hide");
}


//#endregion



/**
 * Functions to fill all list name values according to MUR4_SitesConfiguration
 */
async function listValues(filter) {
    // gets the values from MUR4_SitesConfiguration list
    try {

        let usrBuilding = 0;
        path = `${url}/_api/web/lists/getbytitle('MUR4_SitesConfiguration')/items?$filter=${filter}`;
        if (filter == '' || filter == null || filter == undefined) {
            usrBuilding = getUserProperty("FordBuildingNo");
            path = `${url}/_api/web/lists/getbytitle('MUR4_SitesConfiguration')/items`;
        }

        const response = await fetch(path, {
            headers: ACCEPT
        });

        const data = await response.json();
        // console.log(data);
        data.d.results.map(async val => {
            let codes = val.BuildingCodeNo;
            if (codes !== null) {
                if (codes.includes(usrBuilding) || usrBuilding === 0) {
                    // set the values of the names of the lists
                    buildingCodes = (val.BuildingCodeNo).split(',');
                    LISTAITSERVICES = val.IT_Services;
                    LISTACATALOGOF = val.ServiceConfiguration;
                    LISTAUNIVERSALREQUEST = val.UniversalRequest_name;
                    LISTAATTACHMENTS = val.AttachmentsMUR4;
                    LISTAAPPROVALS = val.Approvals;
                    LISTALANGUAGES = val.LanguagesList;
                    url = val.UniversalRequest;
                    urlLang = val.Languages;
                    SiteCode = val.SiteCode;
                    codeExists = true;

                    DIGEST = await getExternalDigestValue(url);

                    POST["X-RequestDigest"] = DIGEST;
                    MERGE["X-RequestDigest"] = DIGEST;
                }
            }
        })

    } catch (e) {
        alert('Error al cargar configuración inicial');
        console.log(e);
    }
}

async function load() {
    let i_itemid = getUrlParameter("num");
    i_itemid = (typeof i_itemid === 'undefined') ? 0 : i_itemid;

    $('#currentRequestId').val(i_itemid);

    if (i_itemid > 0)
        LoadRequestData(i_itemid);
    else {
        $('#ddlLanguage').val('en');

        await fillRequestorData();
        await LoadLocations();
        loadLang('en');
    }
}

const DOMO365 = "i:0#.f|membership|";
const _FORD = '@ford.com';

let _url = '';
// const SITEURL = _spPageContextInfo.webServerRelativeUrl;
// console.log(_spPageContextInfo);
// let url = _spPageContextInfo.siteServerRelativeUrl;
const ACCEPT = {
	"accept": "application/json;odata=verbose"
};
let POST = {
	"Accept": "application/json;odata=verbose",
	"Content-Type": "application/json;odata=verbose",
};
let MERGE = {
    "Accept": "application/json;odata=verbose",
	"Content-Type": "application/json;odata=verbose",
    "X-HTTP-Method": "MERGE",
    "If-Match": "*",
};

$(async function () {
	_url = _spPageContextInfo.webServerRelativeUrl;
	// DIGEST = await getExternalDigestValue();
	// POST["X-RequestDigest"] = DIGEST;
	// MERGE["X-RequestDigest"] = DIGEST;
});

function GetByProp(arrP, prop) {
	let arr = jQuery.grep(arrP, function (n, i) {
		return (n.Key == prop);
	});

	if (arr !== undefined && arr.length > 0)
		return arr[0].Value;
	else
		return "";
}

/**
 * Functions used to send and email with the info based in the params
 */
/**
 * 
 * @param from Refers to the account who sends the email
 * @param to Refers to the account who receives the email
 * @param body It is the content of the email
 * @param cc Refers to the acounts who also are going to receive the email
 * @param subject It is a short title which the email is going to be about
 */
async function sendEmail(from, to, body, cc, subject) {

	EnsureUsers(to);
	EnsureUsers(cc);

	let urlTemplate = `${getHostName()}/_api/SP.Utilities.Utility.SendEmail`;
	let digest = await getExternalDigestValue(getHostName());

	POST['X-RequestDigest'] = digest;
	
	let data = {
		'properties': {
			'__metadata': {
				'type': 'SP.Utilities.EmailProperties'
			},
			'From': from,
			'To': { 'results': to },
			'CC': { 'results': cc },
			'Body': body,
			'Subject': subject,
			"AdditionalHeaders":
			{
				"__metadata": { "type": "Collection(SP.KeyValue)" },
				"results":
					[
						{
							"__metadata": {
								"type": 'SP.KeyValue'
							},
							"Key": "content-type",
							"Value": 'text/html',
							"ValueType": "Edm.String"
						}
					]
			}
		}
	};

	await fetch(urlTemplate, {
		method: 'POST',
		contentType: 'application/json',
		body: JSON.stringify(data),
		headers: POST
	})
}

function EnsureUsers(arrU) {

	$(arrU).each(function (index, element) {
		if (isNullOrWhitespace(element)) {
			return;
		}
		element = element.indexOf('\\') > -1 ? element.split('\\')[1] : element;
		element = element.indexOf(DOMO365) > -1 ? element : DOMO365 + element;
		element = (element.indexOf(_FORD) > -1 ? element : element + _FORD).toString().toLowerCase();

		if (!isNullOrWhitespace(element)) {
			let clientContext = SP.ClientContext.get_current();
			let web = clientContext.get_web();
			let newUser = web.ensureUser(element);
			clientContext.load(newUser);
			clientContext.executeQueryAsync(
				function (data) {
				},
				function (sender, args) {
				});
		}
	});
}

/**
 * Function used to get the FormDigestValue to access the content
 */
/**
 * 
 * @param p_url 
 * @returns Returns the FormDigestValue
 */
async function getExternalDigestValue(p_url){
    let externalDigestValue;
	let path = `${p_url}/_api/contextinfo`;
	try{
		const response = await fetch(path, {
			method: 'POST',
			headers: ACCEPT
		});
		const contextData = await response.json();

		externalDigestValue = contextData.d.GetContextWebInformation.FormDigestValue;
		return externalDigestValue;
	}
	catch(e){
		console.log(e);
	}
}

/**
 * Function used to look for the properties of a certain user based on their username
 */
/**
 * 
 * @param username Refers to the user which their properties are looked for
 * @returns Returns the properties of the user searched
 */
async function GetPropertiesFor(username) {

	const url = `${getHostName()}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${username}'`;

	try {
		const response = await fetch(url, {
			headers: ACCEPT
		});

		const data = await response.json();
		return data;
	}
	catch(e) {
		console.log(e);
	}
}

/**
 * 
 * @returns Returns properties related to current logged in user
 */
async function GetMyProps() {
	const url = `${getHostName()}/_api/SP.UserProfiles.PeopleManager/GetMyProperties`;
	try {
		const response = await fetch(url, {
			headers: ACCEPT
		});
		const data = await response.json();
		return data;
	}
	catch(e) {
		console.log(e);
	}
}

/**
 * Function used to get a property from a user
 */
/**
 * 
 * @param property Refers to the property which is looked for from the User
 * @returns Returns the property from the user
 */
function getUserProperty(property) {
	let resp = '';
	let result = objUser.UserProfileProperties.results.filter(value => value.Key === property);
	if (result) resp = result[0].Value;
	
	return resp;
}

/**
 * Function used to filter a list from SharePoint with a query formed by a select and a filter
 */
/**
 * 
 * @param url 
 * @param listName Refers to the name of the list that is wanted to filter
 * @param filterC Refers to the value which the list is going to be filtered
 * @param selectC Refers to the columns from the list that are wanted to be selected
 * @returns Returns the data from the list filtered
 */
async function GetListByQuery(url, listName, filterC, selectC) {
	if (url.endsWith('/')) url = url.substring(0, url.lastIndexOf('/'));
    let path = `${url}/_api/web/lists/getbytitle('${listName}')/items`;

    if (selectC != "" && selectC != undefined) {
        path += "?$select=" + selectC;
    }
    if (filterC != "" || filterC != undefined) {
        path += selectC != "" && selectC != undefined ? "&$filter=" + filterC : "?$filter=" + filterC;
    }

	try {
		const response = await fetch(path, {
			headers: ACCEPT
		});

		const data = await response.json();
		return data;
	}
	catch(e) {
		console.log(e);
		return e;
	}
}

/**
 * Function that adds domain (FORD.COM) to an array of users
 */
/**
 * 
 * @param arr Array of users 
 * @returns Arrays of users users with their CDSID cleaned and in lower case
 */
function AddDomain(arr) {
    let result = [];
    $(arr).each(function (index, element) {
        result.push(cleanCDSIDDomain(element).trim().toLowerCase() + _FORD);
    });
    return result;
}

/**
 * Function that filters a list by an Id
 */

/**
 * 
 * @param listName Name of the list where the search is going to take place
 * @param id Id which will be used for the search
 * @returns Returns the data filtered by the Id
 */
async function GetListByID(url, listName, id) {

    let path = `${url}/_api/web/lists/getbytitle('${listName}')/items/getbyid(${id})`;

	try {
		const response = await fetch(path, {
			headers: ACCEPT
		});
		const data = await response.json();
		return data;
	}
	catch(e) {
		return e;
	}
}

async function AddUserToGroup(user) {
	
	let path = `${_url}/_api/web/sitegroups/GetById(9)/users`;

	try{
		const response = await fetch(path, {
			method: "POST",
			data: JSON.stringify({
				'__metadata': {
				'type': 'SP.User'
				},
				'LoginName': user
			}),
			headers: POST
		});
		const data = await response.json();
		return data;
	}
	catch(e){
		console.log(`Error al registrar usuario ${user} en grupo`);
		return e;
	}
}

async function FindLL6(GerenteCDSID, callback) {
	try {
		const response = await GetPropertiesFor(GerenteCDSID.replace(/#/g, '%23'));
		if (response.d.UserProfileProperties != undefined) {
			if (findValueInUserProfileProperties("ManagerRole", response.d.UserProfileProperties.results) == "Y") {
				callback(response.d);
			} else {
				FindLL6(findValueInUserProfileProperties("Manager",
					response.d.UserProfileProperties.results), callback);
			}
		}
	} catch(e) {
		console.log(e);
		return e;
	}
}

function findValueInUserProfileProperties(key, results) {

	let arr = jQuery.grep(results, function (n, i) {
		return (n.Key == key);
	});

	if (arr !== undefined && arr.length > 0)
		return arr[0].Value;
	else
		return "";

}

function getUrlParameter(sParam) {
	let sPageURL = decodeURIComponent(window.location.search.substring(1)),
		sURLVariables = sPageURL.split('&'),
		sParameterName, i;

	for (i = 0; i < sURLVariables.length; i++) {
		sParameterName = sURLVariables[i].split('=');

		if (sParameterName[0].toUpperCase() === sParam.toUpperCase()) {
			return sParameterName[1] === undefined ? true : sParameterName[1];
		}
	}
}

function getHostName() {

	let pathArray = location.href.split('/');
	let protocol = pathArray[0];
	let host = pathArray[2];
	let baseUrl = protocol + '//' + host;

	return baseUrl;

}

/**
 * Function that cleans the CDSID from the domain
 */
/**
 * 
 * @param cdsid Domain with a CDSID to be clean
 * @returns Return the doamin without the CDSID
 */
function cleanCDSIDDomain(cdsid) {

    let _value = cdsid;

    if(cdsid == null || cdsid == undefined) return null;

    if(_value.includes('FORDNA2\\\\') || _value.includes('FORDNA1\\\\')) {

        while(_value.includes('FORDNA2\\\\')) {
            _value = _value.replace('FORDNA2\\\\', '');
        }
        while(_value.includes('FORDNA1\\\\')) {
            _value = _value.replace('FORDNA1\\\\', '');
        }

    }

    if(_value.includes('FORDNA2\\') || _value.includes('FORDNA1\\')) {

        while(_value.includes('FORDNA2\\')) {
            _value = _value.replace('FORDNA2\\', '');
        }
        while(_value.includes('FORDNA1\\')) {
            _value = _value.replace('FORDNA1\\', '');
        }

    }

    return _value;

}

//Shim When.all for jQuery

// Put somewhere in your scripting environment
if (jQuery.when.all === undefined) {
	jQuery.when.all = function (deferreds) {
		let deferred = new jQuery.Deferred();
		$.when.apply(jQuery, deferreds).then(
			function () {
				deferred.resolve(Array.prototype.slice.call(arguments));
			},
			function () {
				deferred.fail(Array.prototype.slice.call(arguments));
			});

		return deferred;
	}
}

// For MultiLines Fields
let scrollValue = null;
let rowValue = null;

function constraintMultiline(event, element) {

    $(element).val($(element).val().replace(/(\r?\n){1,}/gi, ''));
    $(element).val($(element).val().replace(/(\s){2,}/gi, '$1'));

    scrollValue = (scrollValue === null) ? (Number($(element).prop('scrollHeight')) - Number($(element).height())) : scrollValue;
    rowValue = (rowValue === null) ? ((Number($(element).height()) / Number($(element).attr('rows'))) * (Number($(element).attr('maxRows')))) + Number(scrollValue) : rowValue;

    $(element).css("height", "auto");
    $(element).height($(element).prop('scrollHeight') - scrollValue);

    let widthchar = Math.floor(parseInt($(element).css('width').replace(/[^-\d\.]/g, '')) / 8);
    let heightchar = Math.floor(Number(rowValue) / 24);
    let totalchar = widthchar * heightchar;
    $(element).attr('maxlength', totalchar);

}
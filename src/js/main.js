var products = new Kinvey.Collection('Products');
var ingredients = new Kinvey.Collection('Ingredients');
var autocomplete = [];
var currentProduct = {};
var currentUser;

var info = function(x) {
	console.log(x);
}

var getAutocomplete = function() {
	$.ajax( {
	    url: 'https://baas.kinvey.com/rpc/kid_TeuFP7irLM/custom/allIngredients',
	    type: 'post',
	    headers: {
	        Authorization: 'Basic ' + btoa('zach:secret'),
	        "X-Kinvey-API-Version": 2
	    },
	    dataType: 'json',
	    success: function( data )
	    {
	        autocomplete = data;
	    }
	} );
};

var getProduct = function(upc) {
	var q = new Kinvey.Query();
	q.on('UPC').equal(upc);
	products.setQuery(q);
	products.fetch({
		resolve: ['Ingredients'],
		success: function(list) {

			// New Product
			if (list.length == 0) {
				currentProduct = new Kinvey.Entity({}, 'Products');
				currentProduct.set('UPC', upc);

				$('#status').text('UPC was not found.  Created a new product.');
				$('#ingredients').val('');
				$('#addIngredient').focus();

			// Found an Existing Product
	        } else if (list.length == 1) {
	        	currentProduct = list[0];

				$('#status').text('Product found.');
				var iText = '';
				var ing = currentProduct.get('Ingredients');
				for(var i=0; i<ing.length; i++) {
					iText = iText + ing[i].get('Name');
					if (i < ing.length - 1) iText = iText + ', ';
				}
				$('#ingredients').val(iText);
				$('#addIngredient').focus();

			// Found Multiple Products
	        } else {
	        	info('Found more than one product for upc ' + upc);
	        }
 	    },
	    error: function(e) {
	    	info('Error getting product ' + upc);
	    	info(e);
	    }
	});
}

var getIngredient = function(name) {
	function toTitleCase(str) {
	    return str
	}
	name = toTitleCase(name.trim());

	var ing = ingredientCache[name];
	if (ing == null) ing = new Kinvey.Entity({ Name : name}, 'Ingredients');
	return ing;
}

var saveProduct = function() {
	
	// Split and normalize all of the ingredients
	var ings = $('#ingredients').val().split(",");
	for (var i=0; i < ings.length; i++) {
		ings[i] = ings[i].trim().replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	}

	// See if we can find some of these in the database
	var q = new Kinvey.Query();
	q.on('Name').in_(ings);
	var matched = new Kinvey.Collection('Ingredients', { query: q });
	matched.fetch({
	    success: function(list) {
	    	info(list);
	    	var ingredientCache = {};
	    	var ingsOut = new Array(ings.length)
	    	for (var i=0; i < list.length; i++) {
	    		ingredientCache[list[i].get('Name')] = list[i];
	    	}
	    	for (var i=0; i < ings.length; i++) {
	    		ingsOut[i] = ingredientCache[ings[i]];
	    		if (ingsOut[i] == null) {
	    			ingsOut[i] = new Kinvey.Entity({Name : ings[i]}, 'Ingredients');
	    			autocomplete.push(ings[i]);
	    		}
	    	}
	    	currentProduct.set('Ingredients', ingsOut);
			currentProduct.save({
			    success: function(savedEntity) {
			    	info('Saved');
			    },
			    error: function(e) {
			    	info('Error');
			    	info(e);
			    }
			});

	    },
	    error: function(e) {
	    	info('Error');
	    	info(e);
	    }
	});
};

var login = function(username, password) {
	info("Logging in");
	var user = new Kinvey.User();
	user.login(username, password, {
	    error: function(e) {
	    	info('Could not log in');
			info(e);
			$("#password-inp").val('');
			$("#vaildation-message").before(getErrorMessage('Validation error(s)', [e.description]));
	    },
	    success: function(i) {
			currentUser = Kinvey.getCurrentUser();
	    	info('Logged in');

			$("#password-inp").val('');
			$("#login-inp").val('');
			$("#login-block").addClass("hide");
			$("#default-block").removeClass("hide");
			$("#username-lbl").html("Hello, " + currentUser.attr.name);
			$("#userinfo").css("display", "block");
			
	    	info("Sync: Configuring");
			Kinvey.Sync.configure({
			    start: function() {
			    	info("Sync: Starting");
			    	info(Kinvey.getCurrentUser());
			    },
			    success: function(status) {
			    	info("Sync: Success");
			    	info(status);
			    },
			    error: function(e) {
			    	info("Sync: Error");
			    	info(e);
			    }
			});

			info("Pinging Kinvey")
			Kinvey.ping({
			  success: function(response) {
			    info('Kinvey Ping Success. Kinvey Service is alive, version: ' + response.version + ', response: ' + response.kinvey);
			  },
			  error: function(error) {
			    info('Kinvey Ping Failed. Response: ' + error.description);
			  }
			});
		}
	});
};

var getErrorMessage = function (label, errors) {
	var error_html = '<div class="alert alert-error">'
					+ '<button type="button" class="close" data-dismiss="alert">&times</button>'
					+ '<strong>' + label + '</strong>',
		errors_count = errors.length,
		i = 0;

	for (; i < errors_count; i++) {
		error_html += '<br />' + errors[i];
	}

	return error_html;
};

var sync = function() {
	Kinvey.Sync.offline();
	Kinvey.Sync.online();
}

$(document).ready(function() {

	$("#login-btn").on("click", function (e) {
		var username = $("#login-inp").val(),
			password = $("#password-inp").val(),
			errors = [];
		if ((username === '') || (password === '')) {
			username === '' && (errors.push('Username cannot be empty.'));
			password === '' && (errors.push('Password cannot be empty.'));
			$("#vaildation-message").before(getErrorMessage('Validation error(s)', errors));
			return false;
		}
		login(username, password);
	});
	
	$("#logout-btn").on('click', function () {
		currentUser.logout({
			success: function () {
				info('Logout successfully');
				$("#login-block").removeClass("hide");
				$("#default-block").addClass("hide");
				$("#userinfo").css("display", "none");
				currentUser = null;
			},
			error: function (e) {
				info('An error occured: ' + e.description);
			}
		});
	});
 
    $( "#addIngredient" ).typeahead({source : function(query, process) {
    	process(autocomplete);
    }});


	$("#upc").keypress(function(e) {
    	if (e.keyCode == 13) {
    		getProduct($("#upc").val());
    	}
    });

	$("#addIngredient").keypress(function(e) {
    	if (e.keyCode == 13) {
    		var current = $('#ingredients').val().trim();
    		if(current.length > 0) current = current + ", ";
    		current = current + $('#addIngredient').val();
    		$('#ingredients').val(current);
    		$('#addIngredient').val('');
    	}
    });

	$('#save').click(function(){
		saveProduct();
		$('#upc').focus();
		$('#upc').select();	
	});


	info("Initializing Kinvey.");
	
	Kinvey.init({
	    'appKey': 'kid_TeuFP7irLM',
	    'appSecret': '18040ec8b39846c0a2aabf83981e6153',
	    sync: true
	});
	
	Kinvey.ping({
	  success: function(response) {
		info('Kinvey Ping Success. Kinvey Service is alive, version: ' + response.version + ', response: ' + response.kinvey);
	  },
	  error: function(error) {
		info('Kinvey Ping Failed. Response: ' + error.description);
	  }
	});	

	currentUser = Kinvey.getCurrentUser();
	if (currentUser) {
		$("#default-block").removeClass("hide");
		$("#username-lbl").html("Hello, " + currentUser.attr.name);
		$("#userinfo").css("display", "block");
	} else {
		$("#login-block").removeClass("hide");
	}

	
	info("After init");
	getAutocomplete();

});

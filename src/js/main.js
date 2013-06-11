var products = new Kinvey.Collection('Products');
var ingredients = new Kinvey.Collection('Ingredients');
var autocomplete = [];
var currentProduct = {};

var info = function(x) {
	console.log(x);
}

var getAutocomplete = function() {
	$.ajax( {
	    url: 'https://baas.kinvey.com/rpc/kid_TeuFP7irLM/custom/allIngredients',
	    type: 'post',
	    headers: {
	        Authorization: 'Basic a2lkX1RldUZQN2lyTE06YjVmZmJiMzljNmVlNGFlOTgyNWZlYmU2ZjMwYWZlM2I=',   //If your header name has spaces or any other char not appropriate
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

var login = function() {
	info("Logging in");
	var user = new Kinvey.User();
	user.login('zach', 'secret', {
	    error: function(e) {
	    	info('Could not log in');
	    },
	    success: function(i) {
	    	info('Logged in');

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

var sync = function() {
	Kinvey.Sync.offline();
	Kinvey.Sync.online();
}

$(document).ready(function() {
 
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


	info("Initializing Kinvey.");
	Kinvey.init({
	    'appKey': 'kid_TeuFP7irLM',
	    'appSecret': '18040ec8b39846c0a2aabf83981e6153',
	    sync: true
	});

	getAutocomplete();

});

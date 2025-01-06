// Copyright (c) 2021, OneHash Inc and contributors
// For license information, please see license.txt

frappe.ui.form.on('Facebook Settings', {
	refresh: function (frm) {
		var app_id;
		var user_access_token;
		var user_id;
		var lead_fields;
		var lead_labels = [];
		var field_mapping = {};
		var form_name;
		var current_form;
		var current_page;
		var current_token;
		var show_subs = false;


		window.fbAsyncInit = function () {
			frappe.call({
				method: "facebook_integration.facebook_integration.facebook_subscription.fetch_app_id",
				callback: function (r) {
					if(r.message != "error"){
						app_id = r.message
						FB.init({
							appId: app_id,
							xfbml: true,
							version: 'v10.0'
						});
						console.log("Successfully loaded fb init");
					}
				}
			})
			frappe.call({
				method: "facebook_integration.facebook_integration.facebook_subscription.fetch_fields",
				callback: function (r) {
					if (r.message != "error") {
						var x;
						lead_fields = r.message
						for (x in lead_fields) {
							lead_labels.push(x);
						}
						lead_labels.sort()
						lead_labels.unshift("Do Not Map")
					}
				}
			})
		};

		(function (d, s, id) {
			var js, fjs = d.getElementsByTagName(s)[0];
			if (d.getElementById(id)) { return; }
			js = d.createElement(s); js.id = id;
			js.src = "https://connect.facebook.net/en_US/sdk.js";
			fjs.parentNode.insertBefore(js, fjs);
		}(document, 'script', 'facebook-jssdk'));

		function subscribeApp(page_id, page_access_token, form_id, mapping_data) {
			frappe.show_progress('Subscribing...', 70, 100, 'Please wait');
			console.log('Subscribing page ' + page_id + ' to app!');
			FB.api(
				'/' + page_id + '/subscribed_apps',
				'post',
				{ access_token: page_access_token, subscribed_fields: ['leadgen'] },
				function (response) {
					if (response && !response.error) {
						console.log('Successfully subscribed page', [user_access_token, user_id, page_id, form_id, mapping_data, page_access_token]);
						frappe.call({
							method: "facebook_integration.facebook_integration.facebook_subscription.send_subscription",
							args: {
								"page_id": page_id, "page_access_token": page_access_token, "form_id": form_id,
								"user_access_token": user_access_token, "user_id": user_id, "field_mapping": mapping_data,
							},
							callback: function (r) {
								console.log(r)
								if (r.message == "success") {
									frappe.hide_progress("Subscribing...")
									frappe.msgprint("Page subscribed successfully.")
								} else {
									frappe.hide_progress("Subscribing...")
									// frappe.msgprint('Hi '+str(r.message))
									frappe.msgprint("An error occured while subscribing page. Please try again.")
								}
							}
						})
					}
				}
			);
		}

		function myFacebookLogin() {
			if (frappe.user.has_role("System Manager")) {
				console.log("Hi")
				FB.login(function (response) {
					console.log(response)
					if (response.authResponse) {
						console.log('Successfully logged in');
						user_access_token = response.authResponse.accessToken
						user_id = response.authResponse.userID
						FB.api('/me/accounts', function (response) {
							console.log('Successfully retrieved pages');
							var pages = response.data;
							var pages_list = []
							var pages_name = []
							var forms_name = []
							for (var i = 0, len = pages.length; i < len; i++) {
								var page = pages[i];
								pages_name.push(page.name)
								pages_list.push(page)
							}
							var dialog = new frappe.ui.Dialog({
								title: "Select Page to Subscribe",
								fields: [
									{ "fieldtype": "Autocomplete", "label": __("Select a Page"), "fieldname": "page", "options": pages_name },
									{ "fieldtype": "Button", "label": "Fetch Forms", "fieldname": "fetch_forms" },
									{ "fieldtype": "Autocomplete", "label": __("Select a Form"), "fieldname": "form", "options": forms_name, "hidden": true },
									{ "fieldtype": "Button", "label": "Fetch Fields", "fieldname": "fetch_fields", "hidden": true },
								]
							});
							var fetch_forms = dialog.get_field("fetch_forms");
							fetch_forms.$input.addClass("btn btn-primary btn-xs");
							fetch_forms.refresh();
							dialog.fields_dict.fetch_forms.input.onclick = function () {
								var page_name = dialog.get_field("page").value
								for (var j = 0, len = pages_list.length; j < len; j++) {
									if (pages_list[j].name == page_name) {
										current_page = pages_list[j].id
										current_token = pages_list[j].access_token
										FB.api(
											'/' + pages_list[j].id + '/leadgen_forms',
											'GET',
											{ "access_token": pages_list[j].access_token,"limit":200 },
											function (response) {
												if (response && !response.error) {

													var forms = response.data;
													var forms_list = []
													for (var m = 0, len = forms.length; m < len; m++) {
														var form = forms[m];
														forms_name.push(form.name)
														forms_list.push(form)
													}
													var field = dialog.get_field("form");
													field.df.hidden = false;
													field.refresh();
													var fetch_fields = dialog.get_field("fetch_fields");
													fetch_fields.df.hidden = false;
													fetch_fields.refresh();
													fetch_fields.$input.addClass("btn btn-primary btn-xs");
													fetch_fields.refresh();

													// dialog.fields_dict.form.input.onchange = function () {
													// 	field_mapping = {}
													// 	for (var q in dialog.fields_dict) {
													// 		if (!["page", "fetch_forms", "form", "fetch_fields"].includes(q)) {
													// 			var temp_field = dialog.get_field(q);
													// 			temp_field.df.hidden = true;
													// 			temp_field.refresh();
													// 			delete dialog.fields_dict[q]
													// 			dialog.get_primary_btn().hide()
													// 		}
													// 	}
													// 	form_name = null;
													// 	current_form = null;
													// }
													dialog.fields_dict.fetch_fields.input.onclick = function () {
														form_name = dialog.get_field("form").value
														for (var n = 0, len = forms_list.length; n < len; n++) {
															if (forms_list[n].name == form_name) {
																current_form = forms_list[n].id
																FB.api(
																	'/' + forms_list[n].id,
																	'GET',
																	{ "fields": "questions" },
																	function (response) {
																		if (response && !response.error) {
																			show_subs = true
																			var questions = response.questions
																			for (var i = 0, len = questions.length; i < len; i++) {
																				dialog.make_field({ "fieldtype": "Autocomplete", "label": questions[i].label, "fieldname": questions[i].key, "options": lead_labels, "reqd": 1 })
																				dialog.get_field(questions[i].key).refresh();
																				field_mapping[questions[i].key] = [questions[i].label]
																			}

																			dialog.set_primary_action(__('Subscribe'), function () {

																				for (var k in field_mapping) {
																					field_mapping[k][1] = dialog.get_field(k).value
																					if (dialog.get_field(k).value != "Do Not Map") {
																						field_mapping[k][2] = lead_fields[dialog.get_field(k).value][0]
																						field_mapping[k][3] = lead_fields[dialog.get_field(k).value][1]
																					}
																				}
																				subscribeApp(current_page, current_token, current_form, field_mapping);
																				dialog.hide();
																			})
																			dialog.get_primary_btn().show()

																		}
																	}
																);
															}

														}

													}
												}
											}
										);
									}
								}
							}

							dialog.show();
						});
					} else {
						frappe.msgprint("An error occured while login. Please retry.")
						console.log('User cancelled login or did not fully authorize.');
					}
				}, { scope: ['pages_show_list', 'leads_retrieval', 'pages_manage_ads', 'pages_manage_metadata', 'pages_read_engagement'] });

			} else { frappe.msgprint("User must be logged in as System Manager.") }
		}
		frm.add_custom_button(__('Login with Facebook'), function () {
			myFacebookLogin()
		});
		frm.add_custom_button(__('Un-Subscribe Facebook'), function () {
			var unpages = []
			var unforms = []
			var count = 0
			var unsub_data = null
			frappe.call({
				method: "facebook_integration.facebook_integration.facebook_subscription.fetch_subscription",
				callback: function (r) {
					if (r.message == "permission error") {	
						frappe.msgprint("User must be logged in as System Manager.")
					}
					else if(r.message == "Client is not Enabled"){
						frappe.msgprint("Client is not active as Facebook User")
					}
					else if(r.message == "error"){
						frappe.msgprint("An error occurred. Please retry.")
					}
					else if(Object.keys(r.message).length !== 0){
										
						unsub_data = r.message
						for (let key in unsub_data){
							unpages.push(key) 
							count += unsub_data[key].length
						}
						var dialog2 = new frappe.ui.Dialog({
							title: "Select Page to Un-Subscribe",
							fields: [
								{ "fieldtype": "Autocomplete", "label": __("Select a Page"), "fieldname": "unpage", "options": unpages},
								{ "fieldtype": "Button", "label": "Fetch Forms", "fieldname": "fetch_forms2" },
								{ "fieldtype": "Autocomplete", "label": __("Select a Form"), "fieldname": "unform", "options": unforms, "hidden": true },
							]
						});
						dialog2.show();
						var fetch_forms2 = dialog2.get_field("fetch_forms2");
							fetch_forms2.$input.addClass("btn btn-primary btn-xs");
							fetch_forms2.refresh();
							dialog2.fields_dict.fetch_forms2.input.onclick = function () {							
								var unfield = dialog2.get_field("unform");
								unfield.df.hidden = false;
								unfield.df.options = unsub_data[dialog2.get_field("unpage").value]
								unfield.refresh();							
							}
						dialog2.set_primary_action(__('Un-Subscribe'), function () {
								frappe.call({
									method: "facebook_integration.facebook_integration.facebook_subscription.unsubscribe",
									args: {
										"page_id": dialog2.get_field("unpage").value, "form_id": dialog2.get_field("unform").value,
										"count":count
									},
									callback: function (r) {
										if (r.message == "success") {											
											frappe.msgprint("Form un-subscribed successfully.")
										}
										else{
											frappe.msgprint("An error occurred. Please retry.")
										}
									}
								})

							dialog2.hide();
						})
						dialog2.get_primary_btn().show()						
					
				}
				else{
					frappe.msgprint("No active form present")
				}
				}
			})			
		});
	}
});

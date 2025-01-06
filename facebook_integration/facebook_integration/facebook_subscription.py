import frappe
import requests
import json
import re

@frappe.whitelist()
def send_subscription(**kwargs):
    try:
        if "System Manager" in frappe.get_roles(frappe.session.user):
            if not frappe.db.exists("Lead Source", "Facebook"):
                lead_source = frappe.get_doc({
                    "doctype":"Lead Source",
                    "source_name":"Facebook"
                })
                lead_source.insert(ignore_permissions=True)
                frappe.db.commit()
            config = frappe.get_site_config()
            facebook_config = config.get("facebook_config") if config.get("facebook_config") else {}
            master_subscription_endpoint = facebook_config.get("master_subscription_endpoint")
            if master_subscription_endpoint:                            
                resp = requests.post(
                        master_subscription_endpoint, 
                        data={
                            "domain": frappe.local.site or None, 
                            "verify_token": facebook_config.get("client_verify_token"),
                            "page_id": kwargs.get("page_id"),
                            "page_access_token": kwargs.get("page_access_token"),
                            "user_id": kwargs.get("user_id"),
                            "form_id": kwargs.get("form_id"),
                            "user_access_token": kwargs.get("user_access_token"),
                            "field_mapping": kwargs.get("field_mapping"),
                        })
                if json.loads(resp.text) and json.loads(resp.text).get("message") == "success":
                    
                    if frappe.db.exists("Facebook Forms", kwargs.get("form_id")):
                        frappe.delete_doc("Facebook Forms", kwargs.get("form_id"), ignore_permissions=True)
                    
                    facebook_forms = frappe.get_doc({
                        "doctype": "Facebook Forms",
                        "page_id": kwargs.get("page_id"),
                        "form_id": kwargs.get("form_id"),
                        "enabled": 1
                    })
                    for k,v in json.loads(kwargs.get("field_mapping")).items():
                        if v[1] != "Do Not Map":
                            facebook_forms.append("field_mapping", {
                                "facebook_field_label": v[0],
                                "lead_field_label": v[1],
                                "facebook_fieldname": k,
                                "lead_fieldname": v[2],
                                "lead_field_type": v[3]
                            })
                        else:
                            facebook_forms.append("field_mapping", {
                                "facebook_field_label": v[0],
                                "lead_field_label": v[1],
                                "facebook_fieldname": k,
                            })
                    facebook_forms.insert(ignore_permissions=True)
                    frappe.db.commit()
                return (json.loads(resp.text)).get("message")
        else:
            return "permission_error"
    except Exception as e:
        frappe.log_error(frappe.get_traceback())
        return {"error1": frappe.get_traceback()}

@frappe.whitelist()
def fetch_fields(dt="Lead"):
    try:
        if "System Manager" in frappe.get_roles(frappe.session.user):
            fields = {}
            for field in frappe.get_meta(dt).fields:
                if field.fieldtype in ['Date', 'Datetime', 'Text Editor', 'Link', 'Check', 'Select', 'Data'] and field.fieldname not in ["company"]:
                    fields[field.label] = [field.fieldname, field.fieldtype]
            return fields if fields else "error"
        else:
            return "permission error"
    except:
        return "error"

@frappe.whitelist()
def fetch_subscription():
    try:
        if "System Manager" in frappe.get_roles(frappe.session.user):
            config = frappe.get_site_config()
            facebook_config = config.get("facebook_config") if config.get("facebook_config") else {}
            master_subscription_endpoint = facebook_config.get("master_subscription_endpoint")
            if master_subscription_endpoint:
                url = re.split("api/method", master_subscription_endpoint)[0]
                url = url + "api/method/facebook_integration.facebook_integration.doctype.facebook_integration.facebook_integration.get_subscription"
                resp = requests.get(
                            url, 
                            data={
                                "domain": frappe.local.site or None
                            })
                return (json.loads(resp.text)).get("message")
        else:
            return "permission error"
    except:
        frappe.log_error(frappe.get_traceback())
        return "error"

@frappe.whitelist()
def unsubscribe(**kwargs):
    try:
        if "System Manager" in frappe.get_roles(frappe.session.user):
            config = frappe.get_site_config()
            facebook_config = config.get("facebook_config") if config.get("facebook_config") else {}
            master_subscription_endpoint = facebook_config.get("master_subscription_endpoint")
            if master_subscription_endpoint:
                url = re.split("api/method", master_subscription_endpoint)[0]
                url = url + "api/method/facebook_integration.facebook_integration.doctype.facebook_integration.facebook_integration.unsubscribe"
                resp = requests.post(
                            url, 
                            data={
                                "domain": frappe.local.site or None,
                                "page_id": kwargs.get("page_id"),
                                "form_id": kwargs.get("form_id"),
                                "count": kwargs.get("count")
                            })
                return (json.loads(resp.text)).get("message")
        else:
            return "permission error"
    except:
        frappe.log_error(frappe.get_traceback())
        return "error"

@frappe.whitelist()
def fetch_app_id():
    try:
        if frappe.local.conf.facebook_config and frappe.local.conf.facebook_config.get("facebook_app_id"):
            return frappe.local.conf.facebook_config.get("facebook_app_id")
        else:
            frappe.log_error("No Facebook App Id found in Facebook Integration", "Facebook AppId Error")
            return "error"
    except:
        frappe.log_error("No Facebook App Id found in Facebook Integration", "Facebook AppId Error")
        return "error"
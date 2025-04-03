import frappe
from werkzeug.wrappers import Response

@frappe.whitelist(allow_guest=True)
def fb_events(**kwargs):
    """ Whitelisted method as webhook endpoint to verify hub.challenge and receive leadgen data    
    """
    if kwargs.get("hub.challenge"):
        config = frappe.get_site_config()
        facebook_config = config.get("facebook_config") if config.get("facebook_config") else {}
        if kwargs.get("hub.verify_token") == facebook_config.get("facebook_verify_token"):
            return Response(kwargs.get("hub.challenge"))
        else:
            frappe.log_error("Wrong Facebook Verification Token", "Wrong verify_token received while verification of facebook webhook.")
    frappe.utils.background_jobs.enqueue(save_leadgen, queue='default', timeout=None, event=None,	is_async=True, job_name=None, now=False, enqueue_after_commit=False, data=kwargs)
    # cont = frappe.get_doc({
    #     'doctype':'Facebook Leadgen',
    #     'data':str(kwargs) 
    # })
    # cont.insert(ignore_permissions = True)


@frappe.whitelist(allow_guest=True)
def save_leadgen(data):
    """
    Example of leadgen data:
    
    {
        "object": "page",
        "entry": [
            {
                "id": 153125381133,
                "time": 1438292065,
                "changes": [
                    {
                        "field": "leadgen",
                        "value": {
                            "leadgen_id": 123123123123,
                            "page_id": 123123123,
                            "form_id": 12312312312,
                            "adgroup_id": 12312312312,
                            "ad_id": 12312312312,
                            "created_time": 1440120384
                        }
                    },
                    {
                        "field": "leadgen",
                        "value": {
                            "leadgen_id": 123123123124,
                            "page_id": 123123123,
                            "form_id": 12312312312,
                            "adgroup_id": 12312312312,
                            "ad_id": 12312312312,
                            "created_time": 1440120384
                        }
                    }
                ]
            }
        ]
    }
    """
    import json
    from datetime import datetime
    
    if data and data["object"] == "page":
        for entry in data["entry"]:
            for leadgen in entry["changes"]:
                if leadgen["field"] == "leadgen":
                    leadgen_doc = frappe.get_doc({
                        "doctype": "Facebook Leadgen",
                        "id": entry["id"],
                        "status": "Pending",
                        "source": "Facebook",
                        "fetch_time": datetime.fromtimestamp(entry["time"]),
                        "form_id": leadgen["value"]["form_id"],
                        "leadgen_id": leadgen["value"]["leadgen_id"],
                        "lead_creation_time": datetime.fromtimestamp(leadgen["value"]["created_time"]),
                        "page_id": leadgen["value"]["page_id"],
                        "data": json.dumps(data)
                    })
                    leadgen_doc.insert(ignore_permissions=True)

                else:
                    frappe.log_error(
                        "Inappropriate Facebook Data", "Inappropriate data received from Facebook webhook: {}".format(json.dumps(data))
                    )
    else:
        frappe.log_error(
            "Inappropriate Facebook Data",
            "Inappropriate data received from Facebook webhook: {}".format(json.dumps(data))
        )
# def save_leadgen(data):
#     """
#      Example of leadgen data:
    
#     {
#     "object": "page",
#     "entry": {
#         "id": "100694218355981",
#         "time": 1615266457,
#         "changes": [
#         {
#             "value": {
#             "form_id": "909972903162888",
#             "leadgen_id": "780484612873884",
#             "created_time": 1615266455,
#             "page_id": "100694218355981"
#             },
#             "field": "leadgen"
#         }
#         ]
#     },
#     "cmd": "erpnext.erpnext_integrations.doctype.fb.fb_events"
#     }  
#     """
#     import json
#     from datetime import datetime
#     if data and data["object"] == "page":
#         for leadgen in data["entry"][0]["changes"]:
#             if leadgen["field"] == "leadgen":
#                 leadgen_doc = frappe.get_doc({
#                     "doctype": "Facebook Leadgen",
#                     "id": data["entry"]["id"],
#                     "status": "Pending",
#                     "source": "Facebook",
#                     "fetch_time": datetime.fromtimestamp(data["entry"]["time"]),
#                     "form_id": data["entry"]["changes"][0]["value"]["form_id"],
#                     "leadgen_id": data["entry"]["changes"][0]["value"]["leadgen_id"],
#                     "lead_creation_time": datetime.fromtimestamp(data["entry"]["changes"][0]["value"]["created_time"]),
#                     "page_id": data["entry"]["changes"][0]["value"]["page_id"],
#                     "data": json.dumps(data)
#                     })
#                 leadgen_doc.insert(ignore_permissions=True)
#             else:
#                 frappe.log_error("Inappropriate data received from facebook webhook: {}".format(json.dumps(data)), "Inappropriate Facebook Data")
#     else:
#         frappe.log_error("Inappropriate data received from facebook webhook: {}".format(json.dumps(data)), "Inappropriate Facebook Data")

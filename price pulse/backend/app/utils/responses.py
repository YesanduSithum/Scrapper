def success_response(data):
    return {"success": True, "data": data}


def message_response(message: str):
    return {"success": True, "message": message}


def error_response(message: str):
    return {"success": False, "message": message}

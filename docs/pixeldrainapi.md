API documentation
Methods for using pixeldrain programmatically.

Authentication
All methods which create, modify or delete a resource require an API key. API keys can be obtained from your user account’s API keys page.

To use the API key you need to enter it in the password field of HTTP Basic Access Authentication. The username field does not matter, it can be empty or anything else.

Example usage in JavaScript:

const resp = await fetch(
	"https://pixeldrain.com/api/user/files",
	headers: {
		"Authorization": "Basic "+btoa(":"+api_key),
		// The btoa function encodes the key to Base64
	},
)
if(resp.status >= 400) {
	throw new Error(await resp.json())
}
result = await resp.json()
Some JSON responses include fields which end in “_href” (some people don’t know this, but “href” stands for “Hypertext Reference”, the more you know). These point to different places in the API, which you can retrieve with a GET request. The path is to be appended to the API URL, so “/file/someid/thumbnail” becomes “/api/file/someid/thumbnail”.

The base URL for the API is “/api”, all paths below are relative to that URL.

curl example
To upload files to pixeldrain you will need an API key. Get an API key from the API keys page and enter it in the command. Replace the example API key here with your own:

curl -T "file_name.txt" -u :5f45f184-64bb-4eaa-be19-4a5f0459db49 https://pixeldrain.com/api/file/

Form value order
I recommend you put files at the end of every file upload form. By doing this the pixeldrain server can respond to malformed requests before the file upload finishes and this may save you a lot of time and bandwidth when uploading large files. Make sure your HTTP client has support for premature responses, pixeldrain uses them a lot. If the server responds before your request is finished it will always indicate an error and you may abort the connection.

File Methods
POST/file
Description
Upload a file. I recommend that you use the PUT API instead of the POST API. It’s easier to use and the multipart encoding of the POST API can cause performance issues in certain environments.

Parameters
Param	Type	Required	Maximum Size	Default	Description
name	string	false	255 characters	multipart file name	Name of the file to upload
file	multipart file	true	Depends on user subscription	none	File to upload
Returns
HTTP 200: OK

{
	"success": true,
	"id": "abc123" // ID of the newly uploaded file
}
HTTP 422: Unprocessable Entity

{
	"success": false,
	"value": "no_file",
	"message": "The file does not exist or is empty."
}
HTTP 500: Internal Server Error

{
	"success": false,
	"value": "internal",
	"message": "An internal server error occurred."
}
HTTP 413: Payload Too Large

{
	"success": false,
	"value": "file_too_large",
	"message": "The file you tried to upload is too large"
}
HTTP 500: Internal Server Error

{
	"success": false,
	"value": "writing",
	"message": "Something went wrong while writing the file to disk, the server may be out of storage space."
}
HTTP 413: Payload Too Large

{
	"success": false,
	"value": "name_too_long",
	"message": "File Name is too long, Max 255 characters allowed."
}
PUT/file/{name}
Description
Upload a file.

Parameters
Param	Type	Required	Location	Maximum Size	Default	Description
name	string	true	URL	255 characters	none	Name of the file to upload
file	file	true	request body	Depends on user subscription	none	File to upload
Returns
HTTP 201: OK

{
	"id": "abc123" // ID of the newly uploaded file
}
HTTP 422: Unprocessable Entity

{
	"success": false,
	"value": "no_file",
	"message": "The file does not exist or is empty."
}
HTTP 500: Internal Server Error

{
	"success": false,
	"value": "internal",
	"message": "An internal server error occurred."
}
HTTP 413: Payload Too Large

{
	"success": false,
	"value": "file_too_large",
	"message": "The file you tried to upload is too large"
}
HTTP 500: Internal Server Error

{
	"success": false,
	"value": "writing",
	"message": "Something went wrong while writing the file to disk, the server may be out of storage space."
}
HTTP 413: Payload Too Large

{
	"success": false,
	"value": "name_too_long",
	"message": "File Name is too long, Max 255 characters allowed."
}
GET/file/{id}
Description
Returns the full file associated with the ID. Supports byte range requests.

When ‘?download’ is added to the URL the server will send an attachment header instead of inline rendering, which causes the browser to show a ‘Save File’ dialog.

Warning: If a file is using too much bandwidth it can be rate limited. The rate limit will be enabled if a file has three times more downloads than views. The owner of a file can always download it. When a file is rate limited the user will need to fill out a captcha in order to continue downloading the file. The captcha will only appear on the file viewer page (pixeldrain.com/u/{id}). Rate limiting has been added to prevent the spread of viruses and to stop hotlinking. Hotlinking is only allowed when files are uploaded using a Pro account.

Pixeldrain also includes a virus scanner. If a virus has been detected in a file the user will also have to fill in a captcha to download it.

Parameters
Param	Required	Location	Description
id	true	URL	ID of the file to request
download	false	URL	Sends attachment header instead of inline
Returns
HTTP 200: OK

Requested file data
HTTP 404: Not Found

{
	"success": false,
	"value": "not_found",
	"message": "The entity you requested could not be found"
}
HTTP 403: Forbidden

{
	"success": false,
	"value": "file_rate_limited_captcha_required",
	"message": "This file is using too much bandwidth. For anonymous downloads a captcha is required now. The captcha entry is available on the download page"
}
HTTP 403: Forbidden

{
	"success": false,
	"value": "virus_detected_captcha_required",
	"message": "This file has been marked as malware by our scanning systems. To avoid infecting other systems through automated downloads we require you to enter a captcha. The captcha entry is available on the download page"
}
GET/file/{id}/info
Description
Returns information about one or more files. You can also put a comma separated list of file IDs in the URL and it will return an array of file info, instead of a single object. There’s a limit of 1000 files per request.

Parameters
Param	Required	Location	Description
id	true	URL	ID of the file
Returns
HTTP 200: OK

{
	"id": "1234abcd",
	"name": "screenshot.png",
	// Size of the file in bytes
	"size": 5694837,
	// Number of unique file views, views are counted once per IP address
	"views" 1234,
	// Total bandwidth usage of the file
	"bandwidth_used": 1234567890,
	// Premium bandwidth usage, from users with a Pro subscription or bandwidth sharing
	"bandwidth_used_paid": 1234567890,
	// Unique downloads per IP address
	"downloads": 1234,
	"date_upload": 2020-02-04T18:34:05.706801Z,
	"date_last_view": 2020-02-04T18:34:05.706801Z,
	"mime_type" "image/png",
	// Link to a thumbnail of this file
	"thumbnail_href": "/file/1234abcd/thumbnail"
	// SHA256 sum of the file, encoded in hexadecimal
	"hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	// If the current logged in user can edit the file
	"can_edit": true,
}
HTTP 404: Not Found

{
	"success": false,
	"value": "file_not_found"
}
GET/file/{id}/thumbnail?width=x&height=x
Description
Returns a PNG thumbnail image representing the file. The thumbnail image will be 128x128 px by default. You can specify the width and height with parameters in the URL. The width and height parameters need to be a multiple of 16. So the allowed values are 16, 32, 48, 64, 80, 96, 112 and 128. If a thumbnail cannot be generated for the file you will be redirected to a mime type image of 128x128 px.

Parameters
Param	Required	Location	Description
id	true	URL	ID of the file to get a thumbnail for
width	false	URL	Width of the thumbnail image
height	false	URL	Height of the thumbnail image
Returns
A PNG image if a thumbnail can be generated. If a thumbnail cannot be generated you will get a 301 redirect to an image representing the type of the file.

DELETE/file/{id}
Description
Deletes a file. Only works when the users owns the file.

Parameters
Param	Required	Location	Description
id	true	URL	ID of the file to delete
Returns
HTTP 200: OK

{
	"success": true,
	"value": "file_deleted",
	"message": "The file has been deleted."
}
HTTP 404: Not Found

{
	"success": false,
	"value": "file_not_found",
	"message": "File ID was not found in the database."
}
HTTP 401: Unauthorized

{
	"success": false,
	"value": "unauthorized",
	"message": "You are not logged in."
}
HTTP 403: Forbidden

{
	"success": false,
	"value": "forbidden",
	"message": "This is not your file."
}
List Methods
POST/list
Description
Creates a list of files that can be viewed together on the file viewer page.

Parameters
POST body should be a JSON object, example below. A list can contain at most 10000 files. If you try to add more the request will fail.

Example
{
	"title": "My beautiful photos", // Defaults to "Pixeldrain List"
	"anonymous": false / true, // If true this list will not be linked to your user account. Defaults to "false"
	"files": [ // Ordered array of files to add to the list
		{
			"id": "abc123",
			"description": "First photo of the week, such a beautiful valley"
		},
		{
			"id": "123abc",
			"description": "The week went by so quickly, here's a photo from the plane back"
		}
	]
}
Returns
HTTP 200: OK

{
	"success": true,
	"id": "yay137" // ID of the newly created list
}
HTTP 422: Unprocessable Entity

{
	"success": false,
	"value": "list_file_not_found",
	"message": "File Oh42No was not found in the database.",
	"extra": {
		"file_not_found": "0h42No" // The file you tried to add with this ID does not exist
	}
}
HTTP 413: Payload too large

{
	"success": false,
	"value": "too_many_files",
	"message": "This list contains too many files, max 10000 allowed."
}
HTTP 422: Unprocessable Entity

{
	"success": false,
	"value": "json_parse_failed",
	"message": "The JSON object in the request body could not be read."
}
HTTP 413: Payload too large

{
	"success": false,
	"value": "title_too_long",
	"message": "The title of this list is too long, max 300 characters allowed."
}
HTTP 413: Payload too large

{
	"success": false,
	"value": "description_too_long",
	"message": "The description of one of the files in the list is too long, max 3000 characters allowed."
}
HTTP 422: Unprocessable Entity

{
	"success": false,
	"value": "cannot_create_empty_list",
	"message": "You cannot make a list with no files."
}
GET/list/{id}
Description
Returns information about a file list and the files in it.

Parameters
Param	Required	Location	Description
id	true	URL	ID of the list
Returns
The API will return some basic information about every file. Every file also has a “detail_href” field which contains a URL to the info API of the file. Follow that link to get more information about the file like size, checksum, mime type, etc. The address is relative to the API URL and should be appended to the end.

HTTP 200: OK

{
	"success": true,
	"id": "L8bhwx",
	"title": "Rust in Peace",
	"date_created": 2020-02-04T18:34:13.466276Z,
	"files": [
		// These structures are the same as the file info response, except for the detail_href and description fields
		{
			"detail_href": "/file/_SqVWi/info",
			"description": "",
			"success": true,
			"id": "_SqVWi",
			"name": "01 Holy Wars... The Punishment Due.mp3",
			"size": 123456,
			"date_created": 2020-02-04T18:34:13.466276Z,
			"date_last_view": 2020-02-04T18:34:13.466276Z,
			"mime_type": "audio/mp3",
			"views": 1,
			"bandwidth_used": 1234567890,
			"thumbnail_href": "/file/_SqVWi/thumbnail"
		},
		{
			"detail_href": "/file/RKwgZb/info",
			"description": "",
			"success": true,
			"id": "RKwgZb",
			"name": "02 Hangar 18.mp3",
			"size": 123456,
			"date_created": 2020-02-04T18:34:13.466276Z,
			"date_last_view": 2020-02-04T18:34:13.466276Z,
			"mime_type": "audio/mp3",
			"views": 2,
			"bandwidth_used": 1234567890,
			"thumbnail_href": "/file/RKwgZb/thumbnail"
		},
		{
			"detail_href": "/file/DRaL_e/info",
			"description": "",
			"success": true,
			"id": "DRaL_e",
			"name": "03 Take No Prisoners.mp3",
			"size": 123456,
			"date_created": 2020-02-04T18:34:13.466276Z,
			"date_last_view": 2020-02-04T18:34:13.466276Z,
			"mime_type": "audio/mp3",
			"views": 3,
			"bandwidth_used": 1234567890,
			"thumbnail_href": "/file/DRaL_e/thumbnail"
		}
	]
}
HTTP 404: Not Found

{
	"success": false,
	"value": "list_not_found",
}
User Methods
These methods all require authentication.

GET/user/files
GET/user/lists
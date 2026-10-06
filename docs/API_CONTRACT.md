# BRIO Quotation — API Contract (reverse-engineered from live app)

Live app: https://quote.brioelevators.com  (React SPA, Berry MUI template, Vite build)

## Backends (original, .NET)
- Auth API:  `https://quoteauth.brioelevators.com/api/`
- Main API:  `https://quoteapi.brioelevators.com/api/`

This project reimplements both under a single **Django + DRF** service.

## Response envelope
Every endpoint returns:
```json
{ "success": true, "statusCode": 200, "data": <payload> }
```
`statusCode` is echoed inside the body (200 or 201 for reads). Frontend reads `res.data.data`.

## Auth
- `POST auth/login`  body `{ email, password }`
  → `{ accessToken, refreshToken, userProfile: { profileImage, profileName, employeeCode, roles[], franchize } }`
  (NOTE: login/refresh/logout are returned WITHOUT the envelope in the original — top-level object.)
- `POST auth/refreshtoken` body `{ refreshToken }` → `{ accessToken, refreshToken }`
- `POST auth/logout` body `{ RefreshToken, IsLogoutFromAllDevices }` (header `skipAuthRefresh`)

Access token = JWT (RS256 in original; HS256 here). Claims: name, employeeCode (serialnumber), role.
Stored client-side in cookie `serviceToken`.

## Endpoint enum (name → path, method, body)
```
Login                     auth/login                                 POST {email,password}
Refresh                   auth/refreshtoken                          POST {refreshToken}
Logout                    auth/logout                                POST {RefreshToken,IsLogoutFromAllDevices}

Country                   quote/getCountries                         POST {}
State                     quote/getStates                            POST {CountryId}
City                      quote/getCities                            POST {StateId}
Payment_Terms             quote/getPaymentTerms                      POST {...}
Lift_Brands               quote/getLiftBrands                        POST {...}
Lift_Types                quote/getLiftType                          GET
Lift_Models               quote/getModels                            POST {liftTypeId}      -> {models:[]}
Lift_Stops                quote/getStops                             POST {modelId}         -> {stops:[]}
Lift_Shafts               quote/getShafts                            POST {...}             -> []
Lift_VersionTypes         quote/getversion                           POST {modelId}         -> {versions:[]}
Lift_Features             quote/getfeatures                          POST {...}             -> {features:[]}
Lift_SpareType            quote/getsparetypes                        GET                    -> {spareTypes:[]}
Lift_SpareListByTypes     quote/getspareList                         POST {spareTypeId}
Lift_PowerTypes           quote/getPowerDetails                      POST {liftTypeId}      -> [{Id,type}]
Lift_AMC_Warrent          quote/getAMCandWarrenty                    POST {versionId}
Lift_AMC_Warrent_By_Id    quote/getAMCandWarrentyByVersionId         POST {QuoteNumber}
Lift_Price_Details        quote/getTotalPricing                      POST {productInfo...}
Add_Spcl_Price_Details    quote/getSpecialTotalPricing               POST {...}
Create_Quote              quote/createquote                          POST {full quote}      -> data.CustomerId
Get_QuoteList             quote/getListofQuotation                   POST {}                -> [rows]
Get_QuoteDetails          quote/getquote                             GET  ?QuoteId=<QuotationNumber>  -> {response:{...}}
Download_Quote            quote/converthtmltopdfanduploadasync       POST {customerId}
Rebate_Quote              quote/editquote                            POST {...}
InActive_Quote            quote/deletequote                          POST {customerId}
Confirm_Quote             quote/getconfirmquote                      POST {QuoteNumber}

Get_User_Profile          user/getuserprofile                        POST {}
Add_Franchize             user/createfranchize                       POST {...}
Get_Franchize             user/getfranchize                          POST {}                -> [{Id,FranchizeName}]
Add_Branch                user/createbranch                          POST {...}
Get_Branch                user/getofficeaddress                      POST {franchizeId}
Get_Roles                 user/getroles                              POST {}                -> [{Id,Roles}]
Get_RM                    user/getreportingmanger                    POST {franchizeId}
Add_User                  user/createuser                            POST {...}
InActive_User             user/deleteuser                            POST {userId}
Add_Profile               user/updatepersonalinfo                    POST {...}
Change_PW                 user/updatepassword                        POST {...}
Get_User_List             user/userlist                              POST {}                -> {Data:[users]}
Get_Branch_List           user/getofficeaddresslist                  POST {}
Get_Bank_List             user/getbankdetails                        POST {}
Update_User_Official      user/edit-user                             POST {...}
Get_RM_ByUserId           user/editreportingmanger                   POST {userId}
Get_Franchize_Short_Code  user/getempidprefix                        POST {franchizeId}

Dashboard_Card_Count      sales/modelwise-quotation-count            GET                    -> [{product,count}]
```

## Routes (React Router)
```
/login  /forgot  /check-mail  /reset-password            (auth, minimal layout)
/                          -> redirect to /sales-dashboard
/sales-dashboard                                         (dashboard)
/quotation/create                                        (multi-step create quote)
/quotation/list                                          (ag-grid list)
/user-profile/profile-view
/user-profile/list-of-profile     (users list)
/user-profile/list-of-branches
```

## Core objects

### Create-quote payload (POST createquote)
```json
{
 "CustomerId":0,"CustomerName":"","CustomerMobile":"","CustomerEmail":"",
 "CustomerAddress":"","CustomerAddress2":"","CityName":"","StateName":"","CountryName":"",
 "ZipCode":"","LandMark":"","CreatedAt":"",
 "ProductInfo":{"Model":"","Version":"","Stop":"","Shaft":"","Type":"","Feature":"",
   "Door":"","Cabin":"","Lop":"","Cop":"","Ceiling":"","Flooring":"","SOS":"",
   "PowerSupply":"","AuthType":"","Warranty":null,"Amc":null,"Shafts":""},
 "PaymentTerms":[],"ExcludeTax":0,"IncludeTax":0,"Tax":0,
 "SalesInfo":{"SalesBy":"","CreatedBy":"","DeliveryAt":"","SiteReady":"","Remarks":"","CustomerSign":""},
 "WarrentyDetails":[],"Amc":[]
}
```

### Quote detail (GET getquote) — full object
See `captured_schemas/quote_detail_sample.json`. Adds BankInfo, SalesInfo.SalesSignature/FranchizeName/FranchizeCode/FranchizeId, ShaftPrice, initial* pricing fields, ZipCode, CityName/StateName/CountryName, WarrentyDetails[{Duration,TypeOfParts}], Amc[{Duration,AmcType}], PaymentTerms[{Id,TermName,TermValue}].

### Quote list row (POST getListofQuotation)
`QuotationNumber, CustomerName, CreatedDate, Model, Stops, Feature, City, State, CustomerId, Status, QuoteFile`

### Reference data (captured live)
- Roles: BDM, Admin, RM, RSD
- LiftTypes: Home, Commercial
- PowerTypes: 1 Phase, 3 Phase
- SpareTypes: Door, Cabin, LOP, COP, Ceiling, Flooring, Lock, SOS...
- Franchises: BRIO, FRANCHISEE, KAAR VENTURES, INFINITE VENTURES...
- Bank: Brio Elevators LLP / HDFC Bank

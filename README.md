# Carson-Sample-Integration

### Base URL: https://carsondemoservice.herokuapp.com/
### User: CARSON

### In order to qualify for the internship position recently opened by Eleos Technologies, I have created a demo client integration service to learn more about how the Eleos Platform works with its customers' apps. This is my first time creating a back-end system, so much of it I had to learn myself via the internet. However, I found help in Erik Blom, Corey Fuller, and Brandon Dean whenever I ran into a problem I couldn't solve myself. This service was built in Node.JS with an Express.js back-end framework. All data is stored in a PostgreSQL database except for users, which are pulled from my own Airtable division. The service itself is hosted on Heroku.

### This service has the following routes:

- GET "/" : Responds with a basic webpage I created for practice.
- GET "/authenticate/{token}" : Verifies a token. This request will not be retried unless the user chooses to retry. If a 401 is returned, the user is forcibly logged out of the app and required to login again to continue usage. If a different api_token is returned in this response, the token used to authenticate this response is exchanged with the new token for future requests.
- GET "/loads" : This service will enumerate loads for the Eleos Mobile Platform. It is invoked by the platform every time a user updates their load list, which occurs when they open it or refresh the screen manually. This request will not be retried unless the user manually retries it.
- GET "/truck" : Return status related to truck repairs and optionally location.
- GET "/payroll" : This service returns a list of payroll information for the driver.
- GET "/driver_status" : This service will return a boolean driving status value, which will determine in concert with the GPS activity if the app should lock and prevent use. In addition, the service can return hours of service clocks, which will be shown on the hos dashboard card if one is defined.
- GET "/todos" : This service returns a list of upcoming tasks a driver must complete.
- PUT "/messages/{handle}" : This service allows the Eleos Mobile Platform to transmit messages from drivers to this backend system.
- PUT "/tripchanges/{handle}" : This service allows the Eleos Mobile Platform to transmit a change made to a trip to this backend system.

### For security reasons, the only route above accessible in browser is GET "/", since all the others require a valid Eleos platform key and user token. If you would like to see the service work in full, log in to the Eleos QA app with the user "CARSON".

### Concepts/Tools I learned for this project: 

- Postman
- JavaScript
- NodeJS
- ExpressJS
- PostgreSQL
- Heroku
- DBeaver
- A little bit of HTML and Bootstrap
- REST API

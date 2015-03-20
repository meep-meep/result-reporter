middleware that gathers and displays test results

Provides the following routes :

GET /report
    posts (I know I should change this to a post) results for one test
accepts the following query strings :
failures:
    the number of assert failures for this test

testLocation:
    the url that was accessed to execute this test (possibly different from the )

tags:
    the coma-separated tag list that was provided to run this test


all additional query string arguments will be stored as well and made available to build reports

    

GET /results/raw.json
    display raw test results data for every target in json format

GET /results
    display test results for every target in web format

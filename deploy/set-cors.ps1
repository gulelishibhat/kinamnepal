$env:AWS_PAGER = ""
$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$origins = "https://kinamnepal.com,https://www.kinamnepal.com,https://admin.kinamnepal.com,https://seller.kinamnepal.com,http://mkelectric-web-prod-772428488343.s3-website-us-west-2.amazonaws.com,http://mkelectric-admin-prod-772428488343.s3-website-us-west-2.amazonaws.com,http://mkelectric-seller-prod-772428488343.s3-website-us-west-2.amazonaws.com"
& $aws elasticbeanstalk update-environment `
  --environment-name mkelectric-api-prod `
  --option-settings "Namespace=aws:elasticbeanstalk:application:environment,OptionName=CORS_ORIGINS,Value=$origins" `
  --query "{Status:Status,Health:Health}" --output json --region us-west-2

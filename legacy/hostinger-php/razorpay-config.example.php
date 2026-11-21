<?php
/*
 * Copy this file to razorpay-config.php and fill in your details.
 *
 * Upload it to Hostinger in public_html/api/ (blocked from download there) or,
 * even better, one folder above public_html. Never commit the filled-in copy.
 */
return [
    // Razorpay Dashboard → Account & Settings → API Keys
    'key_id' => 'rzp_live_xxxxxxxxxxxxxx',
    'key_secret' => 'xxxxxxxxxxxxxxxxxxxxxxxx',

    // Razorpay Dashboard → Account & Settings → Webhooks → the secret you typed there
    'webhook_secret' => '',

    // Password for https://littletodds.club/admin/ (at least 10 characters)
    'admin_password' => '',

    // Where new-order alerts go
    'notify_email' => 'littletoddsclub@gmail.com',

    // Sender address: create this mailbox in hPanel → Emails so mail is delivered
    'from_email' => 'orders@littletodds.club',
];

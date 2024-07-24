const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/auth/facebook', (req, res) => {
  const facebookLoginUrl = `https://www.facebook.com/v13.0/dialog/oauth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=pages_show_list,instagram_basic`;
  console.log('Redirecting to Facebook login:', facebookLoginUrl);
  res.redirect(facebookLoginUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    console.log('Received code:', code);

    const tokenParams = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code: code,
    };

    const tokenResponse = await axios.get('https://graph.facebook.com/v13.0/oauth/access_token', {
      params: tokenParams,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [querystring.stringify]
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('Access Token:', accessToken);

    const profileResponse = await axios.get(`https://graph.facebook.com/v13.0/me?fields=id,name&access_token=${accessToken}`);
    const userData = profileResponse.data;
    console.log('User Data:', userData);

    const pagesResponse = await axios.get(`https://graph.facebook.com/v13.0/me/accounts?fields=id,name,category,instagram_business_account&access_token=${accessToken}`);
    const pagesData = pagesResponse.data;
    console.log('Pages Data:', pagesData);

    let connectedPage = null;
    if (pagesData.data) {
      connectedPage = pagesData.data.find(account => account.category === 'Business Consultant');
    }

    if (connectedPage) {
      console.log('Connected Facebook Page:', connectedPage);

      let instagramUserId = null;
      let instagramUsername = null;
      let totalFollowers = null;

      if (connectedPage.instagram_business_account) {
        instagramUserId = connectedPage.instagram_business_account.id;
        console.log('Instagram User ID:', instagramUserId);

        const instagramDetails = await fetchInstagramDetails(accessToken, instagramUserId);
        instagramUsername = instagramDetails.username;
        totalFollowers = instagramDetails.followers_count;
        console.log('Instagram Username:', instagramUsername);
        console.log('Total Followers:', totalFollowers);
      }

      const isProfessional = instagramUserId !== null;

      res.render('dashboard', {
        pageData: {
          id: connectedPage.id,
          name: connectedPage.name,
          category: connectedPage.category,
          instagramUserId: instagramUserId,
          instagramUsername: instagramUsername,
          totalFollowers: totalFollowers,
          isProfessional: isProfessional
        }
      });
    } else {
      console.log('No connected Facebook page found.');
      res.status(404).json({ error: 'No connected Facebook page found.' });
    }

  } catch (error) {
    console.error('Error handling callback:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
    res.status(500).send('Failed to authenticate via Facebook.');
  }
});

async function fetchInstagramDetails(accessToken, instagramAccountId) {
  try {
    const response = await axios.get(`https://graph.facebook.com/v13.0/${instagramAccountId}?fields=username,followers_count&access_token=${accessToken}`);
    return {
      username: response.data.username,
      followers_count: response.data.followers_count
    };
  } catch (error) {
    console.error('Error fetching Instagram details:', error.message);
    throw error;
  }
}

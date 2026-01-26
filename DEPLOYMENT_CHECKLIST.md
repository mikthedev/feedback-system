# Deployment Checklist

Use this checklist to ensure your MVP is ready for production.

## Pre-Deployment

### Environment Setup
- [ ] Supabase project created and schema.sql executed
- [ ] Twitch OAuth app created with correct redirect URIs
- [ ] Resend account created and domain verified
- [ ] All environment variables configured in `.env.local`

### Database
- [ ] All tables created (users, submissions, reviews)
- [ ] Indexes created
- [ ] RLS policies enabled
- [ ] Test user created and can authenticate
- [ ] At least one user assigned as curator (role = 'curator')

### Testing
- [ ] Twitch OAuth login works
- [ ] Demo submission accepts valid SoundCloud URLs
- [ ] Demo submission rejects invalid URLs
- [ ] Duplicate submission prevention works (1-hour cooldown)
- [ ] Email confirmation sends successfully
- [ ] Curator can access curator panel
- [ ] Curator can submit reviews
- [ ] User can view their submissions
- [ ] User can see review scores when reviewed
- [ ] Non-curators cannot access curator panel
- [ ] Logout works correctly

### Security
- [ ] Server-side URL validation working (test with Postman/curl)
- [ ] Enter key prevention on submission form
- [ ] Cookie-based sessions working
- [ ] Role-based access control enforced

## Deployment

### Vercel Setup
- [ ] Repository pushed to GitHub
- [ ] Vercel project created
- [ ] All environment variables added to Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TWITCH_CLIENT_ID`
  - `TWITCH_CLIENT_SECRET`
  - `NEXT_PUBLIC_TWITCH_REDIRECT_URI` (production URL)
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `NEXT_PUBLIC_APP_URL` (production URL)
- [ ] Deployment successful
- [ ] Production URL accessible

### Post-Deployment
- [ ] Twitch OAuth redirect URI updated with production URL
- [ ] Test login on production
- [ ] Test submission on production
- [ ] Test curator panel on production
- [ ] Test iframe embedding in Framer
- [ ] Email delivery working in production

## Production Verification

### Functional Tests
- [ ] User can log in with Twitch
- [ ] User can submit a demo
- [ ] User receives confirmation email
- [ ] Curator can see pending submissions
- [ ] Curator can review submissions
- [ ] User can see review scores
- [ ] App works in iframe

### Security Tests
- [ ] Invalid URLs rejected server-side
- [ ] Unauthenticated requests rejected
- [ ] Non-curators cannot access curator routes
- [ ] Duplicate submissions prevented

## Iframe Embedding

### Framer Setup
- [ ] Add Embed component in Framer
- [ ] Set URL to production Vercel URL
- [ ] Verify app loads correctly
- [ ] Test all functionality within iframe
- [ ] Check responsive design in iframe

## Troubleshooting

If something doesn't work:

1. **OAuth Issues**: Check redirect URI matches exactly
2. **Database Issues**: Verify schema.sql was executed
3. **Email Issues**: Check Resend domain verification
4. **Iframe Issues**: Verify Content-Security-Policy headers
5. **Environment Variables**: Double-check all are set in Vercel

## Support

Refer to README.md for detailed setup instructions.

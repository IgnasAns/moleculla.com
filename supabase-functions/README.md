# Supabase Guide Downloads - Setup Instructions

## Step 1: Run SQL in Supabase

1. Go to https://supabase.com/dashboard/project/ewlyagjutrdlinydjphe/sql-editor
2. Copy and paste the contents of `setup.sql`
3. Click "Run"

## Step 2: Deploy Edge Function

Install Supabase CLI if not already installed:
```
npm install -g supabase
```

Login and link project:
```
supabase login
supabase link --project-ref ewlyagjutrdlinydjphe
```

Deploy the function:
```
supabase functions deploy capture-guide-lead --project-ref ewlyagjutrdlinydjphe
```

## Step 3: Upload PDFs to Storage

1. Go to https://supabase.com/dashboard/project/ewlyagjutrdlinydjphe/storage
2. Open the "guides" bucket
3. Create folder: `copper-dry-body-brushing`
4. Upload: `moleculla-copper-dry-body-brushing-guide.pdf`
5. Create folder: `hormone-balance`
6. Upload: `moleculla-hormone-balance-guide.pdf`

## Step 4: Test

1. Visit https://moleculla.com/product/pdf/
2. Enter an email address
3. Click Download
4. Check that:
   - Email is saved in `guide_leads` table
   - PDF download starts automatically

## Troubleshooting

If download doesn't start:
- Check browser console for errors
- Verify the edge function is deployed: `supabase functions list`
- Check Supabase logs: https://supabase.com/dashboard/project/ewlyagjutrdlinydjphe/logs/edge-logs
- Verify PDF files are uploaded to the correct paths in Storage

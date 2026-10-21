# CineLanka video storage

Prepared integration; do not enable uploads before R2 and the Worker are configured and verified.

1. Activate R2 in Cloudflare. Review checkout and billing yourself. Free tier has limits; usage beyond them is billable.
2. Create an R2 Standard bucket named `cinelanka-videos`. Keep it private.
3. Create a Cloudflare Worker and deploy worker.js. Add an R2 binding named MOVIES pointing to that bucket. R2 access keys are not needed in browser code.
4. Keep the existing R2 incomplete multipart upload cleanup lifecycle enabled. Internal `_uploads/` session objects can be expired with a lifecycle rule after 7 days.
5. The Worker verifies each upload request against Supabase Auth and the existing cinelanka_admins membership. Public video reads go through `/media/videos/...` with byte-range support. Only the site's exact origin may upload.
6. Connect the deployed Worker URL to the site's upload UI, then verify upload, cancel, playback and unauthorized upload rejection before publishing.

Uploads accept MP4/WebM, up to 5 GiB, split into 32 MiB parts. Video codecs still need browser support. Worker requests and R2 reads/writes can incur charges beyond their free allowances.

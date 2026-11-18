# Publishing a site to Cloudflare

FilmFile publishes a site to a Cloudflare R2 bucket, sending only the files that changed, and the bucket serves it on a web address of your own. This guide sets that up: once in Cloudflare and FilmFile's Settings, then a few steps for each site.

You need a Cloudflare account, and for an address of your own, a domain whose DNS is on Cloudflare in that account.

## Once, for every site

### 1. Make an R2 API token

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/r2/overview), open **R2 Object Storage**.
2. Open **Manage API tokens**, then **Create API token**.
3. Under **Permissions**, choose **Object Read & Write**.
4. Under **Specify bucket(s)**, choose **Apply to all buckets in this account**, or only the buckets you'll publish to (you can edit the token later to add more).
5. Press **Create API token**, and copy the **Access Key ID** and **Secret Access Key**. The secret is shown only once.

### 2. Put the keys on this computer

Add a `[filmfile]` profile to `~/.aws/credentials` (make the file if it isn't there):

```ini
[filmfile]
aws_access_key_id = <Access Key ID>
aws_secret_access_key = <Secret Access Key>
```

FilmFile reads the keys from here each time it publishes. It never stores them, sends them to the page or writes them in its log. Each computer you publish from needs its own copy of this file.

### 3. Give FilmFile your account ID

1. In the Cloudflare dashboard, click the user menu at the top right of the page, then **Copy account ID**.
2. In FilmFile, open **Settings**. Under **Cloudflare**, paste it into **Account ID** and press **Save**.
3. The line under it should read "Keys: found in the [filmfile] profile of ~/.aws/credentials". If it says there's no profile, check the file's name and place, and that the profile is called exactly `[filmfile]`.

The account ID is kept with the library's settings, so it's the same on every computer.

## For each site

### 4. Make a bucket for the site

1. In **R2 Object Storage**, press **Create bucket**.
2. Give it a name, such as `photos-iceland`: lower-case letters, digits and hyphens. Leave the location on **Automatic**.
3. Press **Create bucket**.

Use this bucket only for this site. Publishing removes anything in it that the site doesn't have, and unpublishing empties it.

### 5. Give the bucket an address

1. Open the bucket, then **Settings**.
2. Under **Custom Domains**, press **Connect Domain** and enter the address, such as `photos.example.com`. Cloudflare adds the DNS record for you.

### 6. Serve the home page at the address

A bucket serves files by their names, so `https://photos.example.com/` needs to be told to show `index.html`. Every other link in a built site names its file, so this is the only rule needed.

1. In the Cloudflare dashboard, open your domain (from the account home, click its name).
2. In the left sidebar, open **Rules**, then **Overview**, and press **Create rule** → **URL Rewrite Rule**. (If you can't find it, search the dashboard for "URL Rewrite".)
3. Give it a name, such as `FilmFile site home page`.
4. Under **If incoming requests match…**, choose **Custom filter expression**, and set **URI Path** **equals** `/`. To touch only this site's address, add **And** **Hostname** **equals** `photos.example.com`.
5. Under **Then…**, set **Path** to **Rewrite to…** → **Static** → `/index.html`, and leave **Query** on **Preserve**.
6. Press **Deploy**.

### 7. Set the site's bucket in FilmFile

On the site's page in FilmFile, under **Publish**, enter the **Bucket** (step 4) and the **Address** (step 5, as `https://photos.example.com`), and press **Save**. It then reads "Not published" (or "Not built yet: Publish builds it first.").

### 8. Publish

Press **Publish**. FilmFile builds the site if it isn't built or is out of date, uploads it, and then reads "Published …, up to date". **View site** opens it.

Publish again whenever you change the site: only what changed is sent. Pages are cached for five minutes, so a change can take that long to show. Images are cached for a year, but an image's name changes whenever it does.

## Backing up the library

The same account and keys back up the whole library (everything in `Library/`, and the library's settings) to a bucket of its own. This works in the FilmFile app.

1. In **R2 Object Storage**, create a bucket for the backup, such as `filmfile-backup`. Use it for nothing else, and don't give it a custom domain or a public address: it stays private.
2. Make sure the token from step 1 covers it (edit the token's buckets if you chose them one by one).
3. In FilmFile, open **Settings**. Under **Sync**, enter the **Bucket** and this computer's name, and press **Save**.
4. Press **Sync**. The first sync sends everything, which can take a while for a big library: it says how much is backed up and about how long is left, and if it's stopped, the next sync carries on. After that, only what's new or changed is sent.

Once it's set up, the cloud at the right of FilmFile's header says when the library was last synced ("Synced 2 h ago"), and clicking it syncs from any page.

A bucket with other things in it is refused, so nothing of anyone else's is mixed in. Cancelling stops a sync within a second or two, and neither that nor a sync that fails part-way loses anything: the next sync carries on from what's already in the bucket.

## Trying it without a domain

Instead of steps 5 and 6, open the bucket's **Settings** and enable **Public Development URL**. The site's home page is then at `https://pub-….r2.dev/index.html`: use that whole address in FilmFile. Cloudflare limits how much an r2.dev address serves, so it's for trying things out, not for sharing.

## When something's wrong

| FilmFile says | What to do |
|---|---|
| Set your Cloudflare account ID in Settings. | Step 3. |
| No [filmfile] profile in ~/.aws/credentials, so the site can't be published. | Step 2, on this computer. |
| Cloudflare refused the keys in the [filmfile] profile. | The token is wrong, was deleted, or doesn't cover this bucket (step 1). |
| There's no bucket … in that Cloudflare account. | The bucket's name (step 7) or the account ID (step 3) doesn't match Cloudflare's. |
| Couldn't reach Cloudflare. Are you online? | Check the connection, then **Check again**. |
| Couldn't publish the site. | Cloudflare said something FilmFile has no words for. The service's output has a line starting `R2 refused`, with Cloudflare's own reason. |

The site's address shows a 404 at its home page but its pages work: the rule in step 6 is missing, or its hostname doesn't match.

Unpublishing removes every file from the bucket; it leaves the bucket, its address and the rule in place, ready to publish again.

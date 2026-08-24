-- AddProject.applescript
--
-- Double-clickable macOS app for adding a new portfolio project without
-- touching git or a terminal. Drag a folder (images + one JSON file) onto
-- the compiled app, or double-click it to pick a folder from a dialog.
--
-- Finds its own repo location and node's location at runtime, so no
-- properties need editing. See scripts/SETUP.md for the one-time setup:
--   1. Compile: osacompile -o AddProject.app scripts/AddProject.applescript
--   2. Place AddProject.app in the repo's root folder (it locates the repo
--      by asking where it itself is running from).
--   3. Make a Desktop alias pointing to it (Cmd+Option+drag the app to the
--      Desktop), so Ryan has a normal-looking icon to use.

on open droppedItems
	handleProject(POSIX path of (item 1 of droppedItems))
end open

on run
	set chosenFolder to choose folder with prompt "Select the folder with your images and JSON file"
	handleProject(POSIX path of chosenFolder)
end run

on resolvedRepoPath()
	-- The app is expected to live directly in the repo's root folder, so its
	-- own parent directory *is* the repo.
	set appPosixPath to POSIX path of (path to me)
	return do shell script "dirname " & quoted form of appPosixPath
end resolvedRepoPath

on resolvedNodePath()
	-- "do shell script" runs a bare /bin/sh with a minimal PATH that doesn't
	-- source .zshrc/.zprofile, so it usually can't see where Homebrew/nvm/etc
	-- put node. Ask Ryan's actual login shell instead of guessing a location.
	try
		return do shell script "zsh -lc 'echo -n $PATH' 2>/dev/null"
	end try
	try
		return do shell script "bash -lc 'echo -n $PATH' 2>/dev/null"
	end try
	return "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
end resolvedNodePath

on handleProject(folderPath)
	set repoPath to resolvedRepoPath()
	set nodePath to resolvedNodePath()
	set shellPrefix to "export PATH=" & quoted form of nodePath & "; cd " & quoted form of repoPath & "; "

	-- Processing (pulling updates, resizing images, a full site build check)
	-- can take a while with no other feedback, which invites an impatient
	-- second drag-and-drop. This auto-dismisses on its own, so it doesn't
	-- actually block — it's just here to set expectations up front.
	display dialog "Working on it — this can take up to a minute. Please don't drop another folder in the meantime." with title "Add Project" buttons {"OK"} default button "OK" giving up after 3

	try
		set prepareOutput to do shell script shellPrefix & "./node_modules/.bin/tsx scripts/add-project.ts prepare " & quoted form of folderPath
	on error errMsg
		display dialog errMsg with title "Couldn't process project" buttons {"OK"} default button "OK" with icon stop
		return
	end try

	-- "do shell script" converts LF newlines in the command's stdout to CR,
	-- so we split on `return` (CR), not `linefeed`.
	set AppleScript's text item delimiters to return
	set outputLines to text items of prepareOutput
	set AppleScript's text item delimiters to ""

	-- Find the "SLUG:<slug>" line wherever it is, rather than assuming it's
	-- always line 1 — a stray line ahead of it (e.g. progress output that
	-- slipped onto stdout) would otherwise silently produce a garbage slug.
	set projectSlug to ""
	set summaryLines to {}
	repeat with i from 1 to (count of outputLines)
		set thisLine to item i of outputLines
		if thisLine begins with "SLUG:" then
			set projectSlug to text 6 thru -1 of thisLine
		else
			set end of summaryLines to thisLine
		end if
	end repeat

	if projectSlug is "" then
		display dialog "Something went wrong reading the result — no project ID was found, so nothing was published." with title "Add Project" buttons {"OK"} default button "OK" with icon stop
		return
	end if

	set AppleScript's text item delimiters to return
	set summaryText to summaryLines as text
	set AppleScript's text item delimiters to ""

	-- Marking a cancel button means pressing Escape or the window's close
	-- control behaves the same as clicking "Cancel" (runs abort, releasing
	-- the lock) instead of raising an uncaught error that would leave the
	-- lock held until its timeout.
	set wantsPublish to false
	try
		display dialog summaryText with title "Add Project" buttons {"Cancel", "Publish"} default button "Publish" cancel button "Cancel"
		set wantsPublish to true
	end try

	if wantsPublish then
		try
			set commitOutput to do shell script shellPrefix & "./node_modules/.bin/tsx scripts/add-project.ts commit " & quoted form of projectSlug
			display dialog commitOutput with title "Add Project" buttons {"OK"} default button "OK"
		on error errMsg
			display dialog errMsg with title "Publish failed" buttons {"OK"} default button "OK" with icon stop
		end try
	else
		try
			do shell script shellPrefix & "./node_modules/.bin/tsx scripts/add-project.ts abort " & quoted form of projectSlug
		end try
		display dialog "Cancelled — nothing was changed." with title "Add Project" buttons {"OK"} default button "OK"
	end if
end handleProject

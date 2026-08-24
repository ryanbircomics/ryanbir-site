-- AddProject.applescript
--
-- Double-clickable macOS app for adding a new portfolio project without
-- touching git or a terminal. Drag a folder (images + one JSON file) onto
-- the compiled app, or double-click it to pick a folder from a dialog.
--
-- One-time setup (see scripts/SETUP.md):
--   1. Fill in repoPath and nodeBinDir below for the machine this runs on.
--   2. Compile: osacompile -o AddProject.app AddProject.applescript
--   3. Drag AddProject.app to the Desktop (or wherever is convenient).

property repoPath : "/Users/ryan/Projects/ryanbir-site"
property nodeBinDir : "/usr/local/bin:/opt/homebrew/bin"

on open droppedItems
	handleProject(POSIX path of (item 1 of droppedItems))
end open

on run
	set chosenFolder to choose folder with prompt "Select the folder with your images and JSON file"
	handleProject(POSIX path of chosenFolder)
end run

on handleProject(folderPath)
	set shellPrefix to "export PATH=" & quoted form of (nodeBinDir & ":/usr/bin:/bin") & "; cd " & quoted form of repoPath & "; "

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

	set slugLine to item 1 of outputLines
	set projectSlug to text 6 thru -1 of slugLine -- strip leading "SLUG:"

	set summaryLines to {}
	repeat with i from 2 to (count of outputLines)
		set end of summaryLines to item i of outputLines
	end repeat
	set AppleScript's text item delimiters to return
	set summaryText to summaryLines as text
	set AppleScript's text item delimiters to ""

	display dialog summaryText with title "Add Project" buttons {"Cancel", "Publish"} default button "Publish"

	if button returned of result is "Publish" then
		try
			set commitOutput to do shell script shellPrefix & "./node_modules/.bin/tsx scripts/add-project.ts commit " & quoted form of projectSlug
			display dialog commitOutput with title "Published" buttons {"OK"} default button "OK"
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
